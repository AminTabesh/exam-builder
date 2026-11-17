import { mathSegments, normalizeAiMath } from "./math.js";
import { z } from "zod";
import {
  newQuestion,
  paragraph,
  hundredths,
  parseExam,
  newExam,
  uid,
} from "./exam.js";

export const generationSchema = z
  .object({
    requestKey: z.string().uuid(),
    topic: z.string().trim().max(500).default(""),
    source: z.string().trim().max(12000).default(""),
    subject: z.string().trim().max(200).default(""),
    grade: z.string().trim().max(100).default(""),
    language: z.enum(["fa", "en"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    instructions: z.string().trim().max(1000).default(""),
    counts: z
      .object({
        mcq: z.number().int().min(0).max(10),
        blank: z.number().int().min(0).max(10),
        written: z.number().int().min(0).max(10),
        matching: z.number().int().min(0).max(10).default(0),
      })
      .strict(),
    marks: z.string().refine((v) => {
      try {
        return hundredths(v) > 0;
      } catch {
        return false;
      }
    }),
  })
  .strict()
  .superRefine((v, ctx) => {
    const n = Object.values(v.counts).reduce((a, b) => a + b, 0);
    if (n < 1 || n > 10)
      ctx.addIssue({
        code: "custom",
        message: "بین یک تا ده سؤال انتخاب کنید.",
      });
    if (!v.topic && !v.source)
      ctx.addIssue({
        code: "custom",
        message: "موضوع یا متن درس را وارد کنید.",
      });
  });

// Keep model output simple: the application, never the model, constructs editor nodes.
export const outputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "body",
          "options",
          "correctIndex",
          "answer",
          "explanation",
          "leftItems",
          "rightItems",
          "matchingPairs",
        ],
        properties: {
          type: {
            type: "string",
            enum: ["mcq", "blank", "written", "matching"],
          },
          leftItems: {
            type: "array",
            maxItems: 12,
            items: { type: "string", minLength: 1, maxLength: 2000 },
          },
          rightItems: {
            type: "array",
            maxItems: 12,
            items: { type: "string", minLength: 1, maxLength: 2000 },
          },
          matchingPairs: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["leftIndex", "rightIndex"],
              properties: {
                leftIndex: { type: "integer", minimum: 0, maximum: 11 },
                rightIndex: { type: "integer", minimum: 0, maximum: 11 },
              },
            },
          },
          body: { type: "string", minLength: 1 },
          options: {
            type: "array",
            maxItems: 4,
            items: { type: "string", minLength: 1 },
          },
          correctIndex: { type: "integer", minimum: -1, maximum: 3 },
          answer: { type: "string", minLength: 1 },
          explanation: { type: "string", minLength: 1 },
        },
      },
    },
  },
};
const item = z
  .object({
    type: z.enum(["mcq", "blank", "written", "matching"]),
    leftItems: z.array(z.string().trim().min(1).max(2000)).max(12).default([]),
    rightItems: z.array(z.string().trim().min(1).max(2000)).max(12).default([]),
    matchingPairs: z
      .array(
        z
          .object({
            leftIndex: z.number().int().min(0).max(11),
            rightIndex: z.number().int().min(0).max(11),
          })
          .strict(),
      )
      .max(12)
      .default([]),
    body: z.string().trim().min(1).max(12000),
    options: z.array(z.string().trim().min(1).max(2000)).max(4),
    correctIndex: z.number().int(),
    answer: z.string().trim().min(1).max(1800),
    explanation: z.string().trim().min(1).max(1800),
  })
  .strict();
export function convertGeneration(value, request) {
  const result = z
    .object({ questions: z.array(item).min(1).max(10) })
    .strict()
    .parse(value);
  const counts = { mcq: 0, blank: 0, written: 0, matching: 0 },
    seen = new Set();
  const questions = result.questions.map((raw) => {
    const q = {
      ...raw,
      body: normalizeAiMath(raw.body, false),
      options: raw.options.map((o) => normalizeAiMath(o)),
      answer: normalizeAiMath(raw.answer),
      explanation: normalizeAiMath(raw.explanation, false),
    };
    counts[q.type]++;
    const normalized = q.body
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const identity =
      q.type === "matching"
        ? JSON.stringify([
            normalized,
            q.leftItems.map((text) => text.normalize("NFKC").trim()).sort(),
            q.rightItems.map((text) => text.normalize("NFKC").trim()).sort(),
          ])
        : normalized;
    if (seen.has(identity)) throw new Error("Duplicate question");
    seen.add(identity);
    if (
      q.type === "mcq" &&
      (q.options.length !== 4 ||
        new Set(q.options.map((o) => o.normalize("NFKC").toLowerCase()))
          .size !== 4 ||
        q.correctIndex < 0 ||
        q.correctIndex > 3)
    )
      throw new Error("Invalid choices");
    if (q.type !== "mcq" && (q.options.length || q.correctIndex !== -1))
      throw new Error("Unexpected choices");
    if (q.type === "blank" && q.body.split("[[blank]]").length !== 2)
      throw new Error("Invalid blank");
    if (!["blank", "matching"].includes(q.type) && q.body.includes("[[blank]]"))
      throw new Error("Unexpected blank");
    const body = richFromAiText(q.body);
    let matching;
    if (q.type === "matching") {
      if (
        !q.leftItems.length ||
        !q.rightItems.length ||
        !q.matchingPairs.length
      )
        throw new Error("Matching columns and pairs are required");
      const left = q.leftItems.map((text) => ({
        id: uid(),
        body: richFromAiText(normalizeAiMath(text, false)),
      }));
      const right = q.rightItems.map((text) => ({
        id: uid(),
        body: richFromAiText(normalizeAiMath(text, false)),
      }));
      matching = {
        left,
        right,
        pairs: q.matchingPairs.map((pair) => {
          if (!left[pair.leftIndex] || !right[pair.rightIndex])
            throw new Error("Invalid matching reference");
          return {
            leftId: left[pair.leftIndex].id,
            rightId: right[pair.rightIndex].id,
          };
        }),
      };
    } else if (
      q.leftItems.length ||
      q.rightItems.length ||
      q.matchingPairs.length
    )
      throw new Error("Unexpected matching data");
    return {
      ...newQuestion(q.type),
      body,
      ...(matching ? { matching } : {}),
      marks: request.marks,
      ...(q.type === "mcq" ? { options: q.options } : {}),
      answer: `${q.type === "mcq" ? q.options[q.correctIndex] : q.answer}\n${q.explanation}`,
    };
  });
  if (Object.keys(counts).some((t) => counts[t] !== (request.counts[t] || 0)))
    throw new Error("Wrong question counts");
  const exam = newExam();
  exam.questions = questions;
  parseExam(exam);
  return questions;
}

function richFromAiText(text) {
  const body = paragraph("");
  body.content[0].content = mathSegments(text).flatMap((part) =>
    part.latex !== undefined
      ? [{ type: "formula", attrs: { latex: part.latex } }]
      : part.text
          .split(/(\[\[blank\]\])/g)
          .filter(Boolean)
          .map((text) =>
            text === "[[blank]]"
              ? { type: "blank", attrs: { width: 90 } }
              : { type: "text", text },
          ),
  );
  return body;
}
