import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWithGroq } from "../apps/backend/src/modules/ai/groq.js";

test("Groq adapter keeps credentials server-side, requests strict output and safely maps provider errors", async () => {
  const originalFetch = globalThis.fetch,
    originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-only-key";
  const input = {
    requestKey: crypto.randomUUID(),
    topic: "Fractions",
    source: "Reference text",
    counts: { mcq: 1, blank: 0, written: 0 },
    marks: "1",
    language: "en",
    difficulty: "easy",
  };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-only-key");
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(!options.body.includes("test-only-key"));
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(
        body.response_format.json_schema.schema.properties.questions.items
          .properties.answer.minLength,
        1,
      );
      assert.equal(
        body.response_format.json_schema.schema.properties.questions.items
          .properties.options.maxItems,
        4,
      );
      const configuration = JSON.parse(
        body.messages.find((message) => message.role === "user").content,
      );
      assert.equal(configuration.source, "Reference text");
      assert.equal(configuration.requestKey, undefined);
      return Response.json({
        choices: [
          { finish_reason: "stop", message: { content: '{"questions":[]}' } },
        ],
      });
    };
    assert.deepEqual(await generateWithGroq(input), { questions: [] });
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      const questions =
        body.response_format.json_schema.schema.properties.questions;
      assert.equal(questions.minItems, 1);
      assert.equal(questions.maxItems, 1);
      assert.deepEqual(questions.items.properties.type.enum, ["matching"]);
      assert.deepEqual(questions.items.properties.correctIndex.enum, [-1]);
      assert.equal(questions.items.properties.options.maxItems, 0);
      for (const key of ["leftItems", "rightItems", "matchingPairs"])
        assert.equal(questions.items.properties[key].minItems, 1);
      assert.equal(
        JSON.parse(body.messages.find((m) => m.role === "user").content).source,
        undefined,
      );
      return Response.json(
        { error: { code: "json_validate_failed" } },
        { status: 400 },
      );
    };
    await assert.rejects(
      generateWithGroq({
        ...input,
        source: "",
        counts: { mcq: 0, blank: 0, written: 0, matching: 1 },
      }),
      (error) => error.code === "AI_INVALID_OUTPUT",
    );
    for (const status of [429, 401, 500]) {
      globalThis.fetch = async () =>
        new Response("private provider details", { status });
      await assert.rejects(
        generateWithGroq(input),
        (e) =>
          e.code ===
            (status === 429 ? "AI_PROVIDER_LIMIT" : "AI_UNAVAILABLE") &&
          !e.message.includes("private"),
      );
    }
    globalThis.fetch = async () => {
      throw new DOMException("timeout", "TimeoutError");
    };
    await assert.rejects(generateWithGroq(input), (e) => e.status === 503);
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ finish_reason: "length", message: { content: "{}" } }],
      });
    await assert.rejects(
      generateWithGroq(input),
      (e) => e.code === "AI_INVALID_OUTPUT",
    );
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: "invalid" } }],
      });
    await assert.rejects(
      generateWithGroq(input),
      (e) => e.code === "AI_INVALID_OUTPUT",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
});
