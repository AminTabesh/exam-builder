import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatePdf } from "../apps/backend/src/modules/exams/pdf.js";
import { exampleExam, newQuestion } from "@exam/shared/exam.js";
import { drawingPreset } from "@exam/shared/drawing.js";
test("scientific diagrams and each bundled font render to embedded-font PDFs", async () => {
  await mkdir("test-results/pdfs", { recursive: true });
  for (const [index, font] of [
    "vazirmatn",
    "noto-naskh",
    "noto-sans",
  ].entries()) {
    const exam = exampleExam();
    exam.layout.fontFamily = font;
    const question = newQuestion();
    question.lines = 0;
    question.body = {
      type: "doc",
      content: [
        {
          type: "drawing",
          attrs: {
            drawing: drawingPreset(
              ["force", "incline", "circuit"][index],
              randomUUID,
            ),
          },
        },
      ],
    };
    exam.questions = [question];
    const pdf = await generatePdf(exam, "student", new Map(), { maxPages: 2 });
    assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
    assert.match(pdf.toString("latin1"), /\/FontFile[23]/);
    if (font === "noto-naskh")
      assert.match(pdf.toString("latin1"), /NotoNaskhArabic/);
    if (font === "noto-sans")
      assert.match(pdf.toString("latin1"), /NotoSansArabic/);
    await writeFile(`test-results/pdfs/${font}-diagram.pdf`, pdf);
  }
});
test("owned custom font is embedded; missing private font blocks export", async () => {
  const id = randomUUID(),
    exam = exampleExam("en");
  exam.layout.fontFamily = id;
  const file = fileURLToPath(
    new URL(
      "../node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf",
      import.meta.url,
    ),
  );
  const pdf = await generatePdf(
    exam,
    "student",
    new Map([[`/api/fonts/${id}/file`, file]]),
  );
  assert.match(pdf.toString("latin1"), /KaTeX_Main/);
  await assert.rejects(generatePdf(exam, "student"), /فونت/);
});

test("B Nazanin is the default and is embedded in student and answer-key exports", async () => {
  const exam = exampleExam();
  assert.equal(exam.layout.fontFamily, "b-nazanin");
  for (const kind of ["student", "answer-key"]) {
    const pdf = await generatePdf(exam, kind);
    assert.match(pdf.toString("latin1"), /BNazanin/);
    assert.match(pdf.toString("latin1"), /\/FontFile[23]/);
  }
});

test("wrapped parabolas retain layout in Persian and English student/answer PDFs", async () => {
  const { defaultParabola } = await import("@exam/shared/parabola.js");
  for (const language of ["fa", "en"]) {
    const exam = exampleExam(language);
    const q = newQuestion();
    q.lines = 0;
    q.body = {
      type: "doc",
      content: [
        {
          type: "parabola",
          attrs: {
            parabola: {
              ...defaultParabola(),
              a: -1,
              b: 2,
              c: 3,
              numericMode: language === "fa" ? "fa" : "en",
              points: [{ x: 1, y: 2, label: "A" }],
            },
            width: 200,
            wrap: language === "fa" ? "right" : "left",
          },
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: (language === "fa"
                ? "ریشه‌های سهمی را پیدا کنید. "
                : "Find the roots of the parabola. "
              ).repeat(8),
            },
          ],
        },
      ],
    };
    exam.questions = [q];
    for (const kind of ["student", "answer-key"]) {
      const pdf = await generatePdf(exam, kind, new Map(), { maxPages: 2 });
      assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
      await writeFile(
        `test-results/pdfs/${language}-parabola-${kind}.pdf`,
        pdf,
      );
    }
  }
});

test("linear graphs with styled points export in both exam languages", async () => {
  for (const language of ["fa", "en"]) {
    const exam = exampleExam(language);
    exam.questions = [newQuestion()];
    exam.questions[0].body = {
      type: "doc",
      content: [
        {
          type: "parabola",
          attrs: {
            parabola: {
              kind: "linear",
              a: 0,
              b: -2,
              c: 3,
              axes: true,
              grid: true,
              equation: false,
              roots: false,
              pointColor: "#ff8800",
              pointLabels: false,
              points: [
                { x: 1, y: 1, label: "A", color: "#abcdef", showInfo: false },
              ],
            },
          },
        },
      ],
    };
    const pdf = await generatePdf(exam, "student");
    assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  }
});
