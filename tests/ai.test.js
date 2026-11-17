import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers.js";
import request from "./request.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { createApp } from "../apps/backend/src/app.js";
import { generationSchema, convertGeneration } from "@exam/shared/ai.js";
import { newExam, parseExam, validateForExport } from "@exam/shared/exam.js";
import { selectedPdfPages } from "../apps/frontend/src/features/exams/aiPdf.js";
let fixture,
  app,
  generate,
  calls = 0;
const codes = new Map();
const payload = (extra = {}) => ({
  requestKey: randomUUID(),
  topic: "Fractions",
  source: "",
  subject: "Math",
  grade: "6",
  language: "fa",
  difficulty: "medium",
  instructions: "",
  counts: { mcq: 1, blank: 0, written: 0 },
  marks: "1",
  ...extra,
});
const output = (input) => ({
  questions: Object.entries(input.counts).flatMap(([type, count]) =>
    Array.from({ length: count }, (_, i) => ({
      type,
      body:
        type === "blank"
          ? `عدد [[blank]] برابر نصف ${i + 2} است.`
          : `${type} question ${i + 1}: $1+1$`,
      options: type === "mcq" ? ["1", "2", "3", "4"] : [],
      ...(type === "matching"
        ? {
            leftItems: ["دو برابر $2$", "سه برابر $2$"],
            rightItems: ["$6$", "$4$", "هیچ‌کدام"],
            matchingPairs: [
              { leftIndex: 0, rightIndex: 1 },
              { leftIndex: 1, rightIndex: 0 },
            ],
          }
        : {}),
      correctIndex: type === "mcq" ? 1 : -1,
      answer: "2",
      explanation: "یک به علاوه یک برابر دو است.",
    })),
  ),
});
before(async () => {
  fixture = await testDatabase();
  await initializeDatabase(fixture.db);
  app = createApp(fixture.db, {
    test: true,
    mongoClient: fixture.client,
    deliverOtp: async (identity, code) => codes.set(identity.value, code),
    aiGenerate: async (input) => {
      calls++;
      return generate(input);
    },
  });
  generate = async (input) => output(input);
});
after(async () => {
  await fixture?.close();
});
async function account(plan = "professional-ai") {
  const agent = request.agent(app),
    identifier = `${randomUUID()}@example.com`;
  const challenge = await agent
    .post("/api/auth/otp/request")
    .send({ identifier })
    .expect(200);
  await agent
    .post("/api/auth/otp/verify")
    .send({
      challengeId: challenge.body.challengeId,
      code: codes.get(identifier),
      name: "AI Teacher",
    })
    .expect(200);
  const { body: user } = await agent.get("/api/auth/me").expect(200);
  if (plan) {
    const order = await agent
      .post("/api/billing/checkout")
      .send({ planId: plan, idempotencyKey: randomUUID() })
      .expect(201);
    await agent
      .post(`/api/billing/orders/${order.body.id}/mock-confirm`)
      .expect(200);
  }
  return { agent, id: user.id };
}
async function clearRate(id) {
  await fixture.db
    .collection("users")
    .updateOne({ id }, { $set: { ai_starts: [] } });
}
test("AI input boundaries and native editor conversion support three types", () => {
  const input = payload({ counts: { mcq: 1, blank: 1, written: 1 } });
  const questions = convertGeneration(output(input), input);
  const exam = newExam();
  exam.meta.title = "test";
  exam.meta.course = "test";
  exam.questions = questions;
  assert.equal(parseExam(exam).questions.length, 3);
  assert.deepEqual(validateForExport(exam), []);
  assert.equal(questions[0].answer, "2\nیک به علاوه یک برابر دو است.");
  assert.ok(
    questions[1].body.content[0].content.some((n) => n.type === "blank"),
  );
  for (const value of [
    payload({ counts: { mcq: 11, blank: 0, written: 0 } }),
    payload({ topic: "", source: "" }),
    payload({ source: "x".repeat(12001) }),
    payload({ marks: "-1" }),
    payload({ marks: "0" }),
  ])
    assert.equal(generationSchema.safeParse(value).success, false);
  for (const mutate of [
    (v) => v.questions[0].options.fill("same"),
    (v) => (v.questions[0].correctIndex = 7),
    (v) => (v.questions[0].answer = ""),
    (v) => v.questions.push(v.questions[0]),
  ]) {
    const value = output(input);
    mutate(value);
    assert.throws(() => convertGeneration(value, input));
  }
});
test("PDF page selection accepts Persian digits and rejects excessive or invalid ranges", () => {
  assert.deepEqual(selectedPdfPages("۱-۳،۵", 6), [1, 2, 3, 5]);
  assert.deepEqual(selectedPdfPages("3,1,1", 3), [1, 3]);
  for (const value of ["0", "4", "2-1", "1-11", "", "1,2,3,4,5,6,7,8,9,10,11"])
    assert.throws(() => selectedPdfPages(value, value === "4" ? 3 : 100));
});
test("AI access is enforced for anonymous, free and existing paid accounts", async () => {
  await request(app).post("/api/ai/generate").send(payload()).expect(401);
  for (const plan of [null, "standard", "professional"]) {
    const { agent } = await account(plan);
    assert.equal(
      (await agent.get("/api/ai/status").expect(200)).body.entitled,
      false,
    );
    await agent.post("/api/ai/generate").send(payload()).expect(403);
  }
});
test("new AI plan has explicit price, entitlement and billing allowance", async () => {
  const { agent } = await account();
  const billing = (await agent.get("/api/billing").expect(200)).body;
  assert.equal(billing.plan.price, 4990000);
  assert.equal(billing.plan.aiGenerations, 100);
  assert.deepEqual(billing.ai, { limit: 100, used: 0, remaining: 100 });
});
test("successful batch is charged once, replayed with identical IDs, and different payload conflicts", async () => {
  const { agent } = await account();
  const input = payload({ counts: { mcq: 1, blank: 1, written: 1 } }),
    start = calls;
  const first = await agent.post("/api/ai/generate").send(input).expect(200);
  const replay = await agent.post("/api/ai/generate").send(input).expect(200);
  assert.equal(calls, start + 1);
  assert.deepEqual(replay.body.questions, first.body.questions);
  assert.equal(replay.body.remaining, 99);
  await agent
    .post("/api/ai/generate")
    .send({ ...input, topic: "Changed" })
    .expect(409);
  assert.equal((await agent.get("/api/billing").expect(200)).body.ai.used, 1);
});
test("failure and invalid provider output release quota; next retry can succeed", async () => {
  const { agent, id } = await account();
  generate = async () => {
    throw new Error("provider disconnected");
  };
  await agent.post("/api/ai/generate").send(payload()).expect(503);
  assert.equal(
    (await agent.get("/api/ai/status").expect(200)).body.remaining,
    100,
  );
  generate = async () => ({ questions: [] });
  await agent.post("/api/ai/generate").send(payload()).expect(502);
  assert.equal(
    (await agent.get("/api/ai/status").expect(200)).body.remaining,
    100,
  );
  await clearRate(id);
  generate = async (input) => output(input);
  await agent.post("/api/ai/generate").send(payload()).expect(200);
});
test("invalid output is retried once and successful recovery is charged once", async () => {
  const { agent } = await account();
  let attempts = 0;
  generate = async input => ++attempts === 1 ? { questions: [] } : output(input);
  const input = payload();
  await agent.post("/api/ai/generate").send(input).expect(200);
  assert.equal(attempts, 2);
  assert.equal((await agent.get("/api/ai/status").expect(200)).body.remaining, 99);
  await agent.post("/api/ai/generate").send(input).expect(200);
  assert.equal(attempts, 2);
});
test("pending requests reserve allowance and prevent duplicate provider calls", async () => {
  const { agent } = await account();
  let release, entered;
  const started = new Promise((resolve) => (entered = resolve));
  generate = (input) =>
    new Promise((resolve) => {
      release = () => resolve(output(input));
      entered();
    });
  const input = payload(),
    pending = agent.post("/api/ai/generate").send(input).expect(200);
  await started;
  try {
    assert.equal(
      (await agent.get("/api/ai/status").expect(200)).body.remaining,
      99,
    );
    await agent.post("/api/ai/generate").send(input).expect(409);
    await agent.post("/api/ai/generate").send(payload()).expect(409);
  } finally {
    release();
    await pending;
    generate = async (input) => output(input);
  }
});
test("last monthly slot cannot be reserved twice concurrently", async () => {
  const { agent, id } = await account();
  const period = await fixture.db
    .collection("subscription_periods")
    .findOne({ owner_id: id });
  await fixture.db.collection("ai_requests").insertMany(
    Array.from({ length: 99 }, () => ({
      _id: randomUUID(),
      owner_id: id,
      period_id: period.id,
      status: "succeeded",
    })),
  );
  const results = await Promise.all([
    agent.post("/api/ai/generate").send(payload()).expect(),
    agent.post("/api/ai/generate").send(payload()).expect(),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.some((r) => [409, 429].includes(r.status)));
  assert.equal(
    (await agent.get("/api/ai/status").expect(200)).body.remaining,
    0,
  );
});
test("stale reservations recover and successful results expire without losing usage", async () => {
  const { agent, id } = await account();
  const period = await fixture.db
    .collection("subscription_periods")
    .findOne({ owner_id: id });
  await fixture.db.collection("ai_requests").insertOne({
    _id: randomUUID(),
    owner_id: id,
    period_id: period.id,
    status: "pending",
    lease_until: new Date(0),
  });
  assert.equal(
    (await agent.get("/api/ai/status").expect(200)).body.remaining,
    100,
  );
  const input = payload();
  await agent.post("/api/ai/generate").send(input).expect(200);
  await fixture.db
    .collection("ai_results")
    .deleteOne({ _id: `${id}:${input.requestKey}` });
  await agent.post("/api/ai/generate").send(input).expect(410);
  assert.equal((await agent.get("/api/ai/status").expect(200)).body.used, 1);
});
test("expired subscription loses access and a new period resets allowance", async () => {
  const { agent, id } = await account();
  await agent.post("/api/ai/generate").send(payload()).expect(200);
  await fixture.db
    .collection("subscription_periods")
    .updateMany(
      { owner_id: id },
      { $set: { ends_at: new Date(Date.now() - 1000) } },
    );
  await agent.post("/api/ai/generate").send(payload()).expect(403);
  const order = await agent
    .post("/api/billing/checkout")
    .send({ planId: "professional-ai", idempotencyKey: randomUUID() })
    .expect(201);
  await agent
    .post(`/api/billing/orders/${order.body.id}/mock-confirm`)
    .expect(200);
  assert.equal(
    (await agent.get("/api/ai/status").expect(200)).body.remaining,
    100,
  );
});
test("shared daily limit blocks provider calls and never consumes monthly allowance", async () => {
  const { agent } = await account();
  const previous = process.env.AI_DAILY_CALL_LIMIT;
  process.env.AI_DAILY_CALL_LIMIT = "0";
  try {
    const start = calls;
    await agent.post("/api/ai/generate").send(payload()).expect(429);
    assert.equal(calls, start);
    assert.equal(
      (await agent.get("/api/ai/status").expect(200)).body.remaining,
      100,
    );
  } finally {
    if (previous === undefined) delete process.env.AI_DAILY_CALL_LIMIT;
    else process.env.AI_DAILY_CALL_LIMIT = previous;
  }
});
