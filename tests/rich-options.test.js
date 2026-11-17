import { test } from "node:test";
import assert from "node:assert/strict";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import {
  exampleExam,
  parseExam,
  validateForExport,
  assetIds,
  paragraph,
} from "@exam/shared/exam.js";
import { drawingPreset } from "@exam/shared/drawing.js";
import { defaultParabola } from "@exam/shared/parabola.js";
import { randomUUID } from "node:crypto";
import PrintDocument from "@exam/shared/PrintDocument.js";
test("rich options validate, preserve assets and render drawings/graphs in both PDF kinds; old strings remain compatible", async () => {
  const exam = exampleExam(),
    id = randomUUID();
  const doc = (node) => ({ type: "doc", content: [node] });
  exam.questions[0].options = [
    doc({
      type: "drawing",
      attrs: { drawing: drawingPreset("force", randomUUID) },
    }),
    doc({ type: "parabola", attrs: { parabola: defaultParabola() } }),
    doc({ type: "image", attrs: { src: `/api/assets/${id}`, width: 100 } }),
    "legacy $x^2$",
  ];
  const parsed = parseExam(exam);
  assert.deepEqual(validateForExport(parsed), []);
  assert.ok(assetIds(parsed).includes(id));
  assert.equal(parsed.questions[0].options[3], "legacy $x^2$");
  for (const kind of ["student", "answer-key"]) {
    const html = await renderToString(
      createSSRApp({ render: () => h(PrintDocument, { exam: parsed, kind }) }),
    );
    assert.ok(html.includes(`/api/assets/${id}`));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("legacy"));
  }
  exam.questions[0].options[0] = doc({
    type: "image",
    attrs: { src: "https://evil.example/image.png" },
  });
  assert.throws(() => parseExam(exam));
  exam.questions[0].options[0] = paragraph("");
  assert.ok(validateForExport(exam).some((e) => e.includes("گزینه")));
  exam.questions[0].options[0] = doc({
    type: "paragraph",
    content: [{ type: "formula", attrs: { latex: "\\badcommand" } }],
  });
  assert.ok(validateForExport(exam).some((e) => e.includes("فرمول")));
});
test("rich graph/drawing options export as actual student and answer-key PDFs", async () => {
  const { generatePdf } =
    await import("../apps/backend/src/modules/exams/pdf.js");
  const exam = exampleExam();
  exam.questions[0].options = [
    {
      type: "doc",
      content: [
        {
          type: "drawing",
          attrs: { drawing: drawingPreset("force", randomUUID), width: 140 },
        },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "parabola",
          attrs: { parabola: defaultParabola(), width: 140 },
        },
      ],
    },
    "third",
    "fourth",
  ];
  for (const kind of ["student", "answer-key"]) {
    const pdf = await generatePdf(parseExam(exam), kind);
    assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), "%PDF");
  }
});
