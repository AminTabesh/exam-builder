import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@vue/server-renderer";
import { h } from "vue";
import PrintDocument from "@exam/shared/PrintDocument.js";
import {
  newExam,
  parseExam,
  validateForExport,
  count,
  total,
  assetIds,
  embeddedImages,
  paragraph,
  uid,
} from "@exam/shared/exam.js";
import { convertGeneration, generationSchema } from "@exam/shared/ai.js";
import { matchingQuestion } from "./fixtures/matching.js";
function exam() {
  const e = newExam();
  e.meta.title = "وصل‌کردنی";
  e.meta.course = "ریاضی";
  e.questions = [matchingQuestion()];
  return e;
}
test("matching allows unequal columns with native rich content and counts as one scored question", () => {
  const e = exam();
  assert.equal(parseExam(e).questions[0].matching.right.length, 3);
  assert.deepEqual(validateForExport(e), []);
  assert.equal(count(e), 1);
  assert.equal(total(e), 100);
  const roundtrip = parseExam(JSON.parse(JSON.stringify(e)));
  assert.deepEqual(roundtrip, e);
});
test("matching rejects missing columns, duplicate item IDs, dangling and duplicate answer links", () => {
  for (const mutate of [
    (q) => delete q.matching,
    (q) => (q.matching.left[1].id = q.matching.left[0].id),
    (q) => (q.matching.pairs[0].rightId = uid()),
    (q) => (q.matching.pairs[1].rightId = q.matching.pairs[0].rightId),
  ]) {
    const e = exam();
    mutate(e.questions[0]);
    assert.throws(() => parseExam(e));
  }
  const e = exam();
  e.questions[0].matching.left = [];
  e.questions[0].matching.pairs = [];
  assert.ok(validateForExport(e).length);
  const formula = e.questions[0].matching.right[0];
  formula.body = {
    type: "doc",
    content: [{ type: "formula", attrs: { latex: "\\invalidcommand" } }],
  };
  assert.ok(validateForExport(e).some((message) => message.includes("فرمول")));
});
test("matching image references participate in private asset validation and local-image detection", () => {
  const e = exam(),
    id = uid();
  e.questions[0].matching.right[0].body = {
    type: "doc",
    content: [
      { type: "image", attrs: { src: "/api/assets/" + id, width: 100 } },
    ],
  };
  assert.deepEqual(assetIds(e), [id]);
  e.questions[0].matching.right[1].body = {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { src: "data:image/png;base64,aGVsbG8=", width: 100 },
      },
    ],
  };
  assert.equal(embeddedImages(e).length, 1);
});
test("matching student HTML never includes correct links; answer key includes pairs and connection layer", async () => {
  const e = exam();
  const student = await renderToString(
    h(PrintDocument, { exam: e, kind: "student" }),
  );
  const answer = await renderToString(
    h(PrintDocument, { exam: e, kind: "answer-key" }),
  );
  assert.match(student, /matching-print-board/);
  assert.doesNotMatch(
    student,
    /data-matching-pairs|matching-connections|اتصال‌های صحیح/,
  );
  assert.match(answer, /data-matching-pairs/);
  assert.match(answer, /matching-connections/);
  assert.match(answer, /اتصال‌های صحیح/);
  assert.match(student, /inline-blank/);
  assert.match(student, /katex/);
});
test("AI matching conversion builds validated unequal rich columns and preserves legacy requests", () => {
  const request = {
    marks: "2",
    counts: { mcq: 0, blank: 0, written: 0, matching: 1 },
  };
  const raw = {
    type: "matching",
    body: "موارد را وصل کنید.",
    options: [],
    correctIndex: -1,
    answer: "دو جفت",
    explanation: "پاسخ‌های درست مشخص شده‌اند.",
    leftItems: ["$2+2$", "سه برابر [[blank]]"],
    rightItems: ["شش", "چهار", "اضافی"],
    matchingPairs: [
      { leftIndex: 0, rightIndex: 1 },
      { leftIndex: 1, rightIndex: 0 },
    ],
  };
  const [q] = convertGeneration({ questions: [raw] }, request);
  assert.equal(q.matching.right.length, 3);
  const separate = { ...raw, leftItems: ["متن متفاوت اول", "متن متفاوت دوم"] };
  assert.equal(
    convertGeneration(
      { questions: [raw, separate] },
      { ...request, counts: { mcq: 0, blank: 0, written: 0, matching: 2 } },
    ).length,
    2,
  );
  assert.throws(
    () =>
      convertGeneration(
        { questions: [raw, raw] },
        { ...request, counts: { mcq: 0, blank: 0, written: 0, matching: 2 } },
      ),
    /Duplicate/,
  );

  assert.match(JSON.stringify(q.matching.left), /formula/);
  assert.match(JSON.stringify(q.matching.left), /blank/);
  assert.equal(q.matching.pairs[0].rightId, q.matching.right[1].id);
  assert.throws(() =>
    convertGeneration(
      {
        questions: [
          {
            ...raw,
            matchingPairs: [
              { leftIndex: 0, rightIndex: 0 },
              { leftIndex: 1, rightIndex: 0 },
            ],
          },
        ],
      },
      request,
    ),
  );
  assert.throws(() =>
    convertGeneration(
      {
        questions: [
          { ...raw, matchingPairs: [{ leftIndex: 0, rightIndex: 9 }] },
        ],
      },
      request,
    ),
  );
  const old = generationSchema.parse({
    requestKey: uid(),
    topic: "math",
    language: "en",
    difficulty: "medium",
    marks: "1",
    counts: { mcq: 1, blank: 0, written: 0 },
  });
  assert.equal(old.counts.matching, 0);
});
