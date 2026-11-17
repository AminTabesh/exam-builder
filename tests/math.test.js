import { test } from "node:test";
import assert from "node:assert/strict";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import PrintDocument from "@exam/shared/PrintDocument.js";
import { exampleExam, validateForExport } from "@exam/shared/exam.js";
import {
  mathSegments,
  mathErrors,
  renderFormula,
  normalizeAiMath,
} from "@exam/shared/math.js";
import { convertGeneration } from "@exam/shared/ai.js";
import {
  formulaGroups,
  templateLatex,
  spliceFormula,
} from "../apps/frontend/src/features/exams/formulaTemplates.js";

test("math delimiters preserve mixed text and render fractions and units", () => {
  for (const value of [
    String.raw`سرعت $\frac{5}{2}\,\text{m/s}^2$ است`,
    String.raw`سرعت \(\frac{5}{2}\,\text{m/s}^2\) است`,
    String.raw`$$\frac{5}{2}$$`,
    String.raw`\[\sqrt{2}\]`,
  ]) {
    const parts = mathSegments(value);
    assert.ok(parts.some((p) => p.latex));
    assert.deepEqual(mathErrors(value), []);
    for (const part of parts)
      if (part.latex) assert.match(renderFormula(part.latex), /katex/);
  }
  assert.deepEqual(mathSegments("plain choice"), [{ text: "plain choice" }]);
  assert.deepEqual(mathSegments("cost \\$5"), [{ text: "cost \\$5" }]);
  assert.equal(mathErrors("$\\frac{$").length, 1);
  assert.deepEqual(
    mathErrors(String.raw`$\frac{5}{2}\text{ متر بر مجذور ثانیه}$`),
    [],
  );
  assert.equal(normalizeAiMath("$dfrac{5}{2}$"), String.raw`$\dfrac{5}{2}$`);
  assert.equal(
    normalizeAiMath(String.raw`\frac{1}{2}`),
    String.raw`$\frac{1}{2}$`,
  );
  assert.equal(
    normalizeAiMath("$5\\,\text{m/s}$"),
    String.raw`$5\,\text{m/s}$`,
  );
  assert.equal(normalizeAiMath("\frac{1}{2}"), String.raw`$\frac{1}{2}$`);
});
test("all visual palette templates render and allow custom values without fixed variable names", () => {
  for (const group of formulaGroups)
    for (const item of group.items) {
      assert.match(renderFormula(templateLatex(item)), /katex/);
      const values = Object.fromEntries(item.fields.map((f) => [f.key, "7"]));
      assert.match(renderFormula(templateLatex(item, values)), /katex/);
    }
  const result = spliceFormula("a+b", 2, 3, String.raw`\frac{1}{\sqrt{t}}`);
  assert.equal(result.value, String.raw`a+\frac{1}{\sqrt{t}}`);
  assert.equal(result.cursor, result.value.length);
  assert.equal(spliceFormula("abcd", 1, 3, "Z").value, "aZd");
});
test("AI formulas normalize across body, choices and answer keys without changing the exam schema", () => {
  const input = { marks: "1", counts: { mcq: 1, blank: 0, written: 0 } };
  const [q] = convertGeneration(
    {
      questions: [
        {
          type: "mcq",
          body: String.raw`سرعت \(x=10\) را بیابید.`,
          options: [
            "$0.5\\,\text{m/s}^2$",
            String.raw`$1\,\text{m/s}^2$`,
            String.raw`$2.5\,\text{m/s}^2$`,
            String.raw`$5\,\text{m/s}^2$`,
          ],
          correctIndex: 1,
          answer: "1",
          explanation: String.raw`شتاب برابر $1\,\text{m/s}^2$ است.`,
        },
      ],
    },
    input,
  );
  assert.ok(
    q.body.content[0].content.some(
      (n) => n.type === "formula" && n.attrs.latex === "x=10",
    ),
  );
  assert.ok(q.options[0].includes("\\text"));
  const exam = exampleExam();
  exam.questions = [q];
  assert.deepEqual(validateForExport(exam), []);
  q.options[0] = "$\\frac{$";
  assert.ok(validateForExport(exam).some((e) => e.includes("گزینه")));
});
test("Persian and English choices and teacher answer keys render math and escape surrounding HTML", async () => {
  for (const language of ["fa", "en"]) {
    const exam = exampleExam(language);
    exam.questions = exam.questions.slice(0, 1);
    exam.questions[0].options = [
      String.raw`$\frac{1}{2}\,\text{m/s}^2$`,
      "<script>alert(1)</script>",
      String.raw`\(\sqrt{3}\)`,
      "4",
    ];
    exam.questions[0].answer = String.raw`$\frac{1}{2}$`;
    const html = await renderToString(
      createSSRApp({
        render: () => h(PrintDocument, { exam, kind: "answer-key" }),
      }),
    );
    assert.ok(html.includes('class="mfrac"'));
    assert.ok(html.includes('class="katex"'));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes("$\\frac"));
  }
});

test("PDF export renders choice and answer formulas with Persian text and SI units", async () => {
  const { generatePdf } =
    await import("../apps/backend/src/modules/exams/pdf.js");
  const exam = exampleExam();
  exam.questions = exam.questions.slice(0, 1);
  exam.questions[0].options = [
    String.raw`$\frac{5}{2}\,\text{m/s}^2$`,
    String.raw`$1\,\text{m/s}^2$`,
    String.raw`$\sqrt{2}$`,
    String.raw`$\vec{v}$`,
  ];
  exam.questions[0].answer = String.raw`$\frac{5}{2}\,\text{m/s}^2$`;
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("test-results/pdfs", { recursive: true });
  for (const kind of ["student", "answer-key"]) {
    const pdf = await generatePdf(exam, kind);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.ok(pdf.length > 1000);
    await writeFile(`test-results/pdfs/math-choices-${kind}.pdf`, pdf);
  }
});
