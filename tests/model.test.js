import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newExam,
  exampleExam,
  newQuestion,
  hundredths,
  total,
  examSchema,
  validateForExport,
  assetIds,
  embeddedImages,
  printStyles,
} from "@exam/shared/exam.js";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import PrintDocument from "@exam/shared/PrintDocument.js";
test("exact decimal scores and Persian digits", () => {
  assert.equal(hundredths("۰٫۲۵"), 25);
  const e = newExam();
  e.questions = [
    { ...newQuestion(), marks: "0.1" },
    { ...newQuestion(), marks: "0.2" },
  ];
  assert.equal(total(e), 30);
  assert.throws(() => hundredths("1.234"));
  assert.throws(() => hundredths("-1"));
});
test("fixtures validate and flag incomplete drafts", () => {
  assert.deepEqual(validateForExport(exampleExam()), []);
  assert.deepEqual(validateForExport(exampleExam("en")), []);
  assert.equal(examSchema.parse(exampleExam()).schemaVersion, 1);
  assert.equal(validateForExport(newExam()).length, 3);
});
test("instructions alignment survives validation and reaches the printed sheet", async () => {
  for (const alignment of ["left", "center", "right", undefined]) {
    const exam = exampleExam();
    if (alignment) exam.meta.instructionsAlign = alignment;
    else delete exam.meta.instructionsAlign;
    const parsed = examSchema.parse(JSON.parse(JSON.stringify(exam)));
    assert.equal(parsed.meta.instructionsAlign, alignment);
    const html = await renderToString(
      createSSRApp({
        render: () => h(PrintDocument, { exam: parsed, kind: "student" }),
      }),
    );
    assert.ok(
      html.includes(
        `class="exam-instructions" style="text-align:${alignment || "center"};"`,
      ),
    );
  }
  const exam = exampleExam();
  exam.meta.instructionsAlign = "invalid";
  assert.equal(examSchema.safeParse(exam).success, false);
});
test("student output excludes model answers and includes blank nodes", async () => {
  const e = exampleExam();
  e.questions[0].answer = "SECRET-TEACHER-ONLY";
  const render = (kind) =>
    renderToString(
      createSSRApp({ render: () => h(PrintDocument, { exam: e, kind }) }),
    );
  const student = await render("student");
  assert.ok(!student.includes("SECRET-TEACHER-ONLY"));
  assert.ok(student.includes("inline-blank"));
  assert.ok(student.includes('dir="rtl"'));
  assert.ok((await render("answer-key")).includes("SECRET-TEACHER-ONLY"));
});
test("printed dates use the exam language digits and preserve the selected calendar", async () => {
  for (const language of ["en", "fa"]) {
    for (const calendar of ["jalali", "gregorian"]) {
      const exam = exampleExam(language);
      exam.meta.calendar = calendar;
      exam.meta.date = calendar === "jalali" ? "۱۴۰۵/۰۸/۱۱" : "۲۰۲۶/۱۱/۰۲";
      const html = await renderToString(
        createSSRApp({
          render: () => h(PrintDocument, { exam, kind: "student" }),
        }),
      );
      const expected =
        language === "fa"
          ? exam.meta.date
          : calendar === "jalali"
            ? "1405/08/11"
            : "2026/11/02";
      assert.ok(
        html.includes(`class="exam-date" dir="ltr">${expected}</span>`),
      );
    }
  }
});
test("English labels, direction and optional school fields", async () => {
  const e = exampleExam("en");
  const html = await renderToString(
    createSSRApp({
      render: () => h(PrintDocument, { exam: e, kind: "student" }),
    }),
  );
  assert.ok(html.includes('dir="ltr"'));
  assert.ok(html.includes("Student code"));
  assert.ok(!html.includes("Faculty:"));
});
test("structured content rejects scripts and external images", () => {
  const e = exampleExam();
  e.questions[0].body = {
    type: "doc",
    content: [{ type: "image", attrs: { src: "https://evil.test/a.png" } }],
  };
  assert.equal(examSchema.safeParse(e).success, false);
  e.questions[0].body = { type: "script", content: [] };
  assert.equal(examSchema.safeParse(e).success, false);
  e.meta.logo = "/api/assets/abc";
  e.questions[0].body = { type: "doc", content: [] };
  assert.deepEqual(assetIds(e), ["abc"]);
});

test("invalid formulas block export and legacy targets are ignored", () => {
  const e = exampleExam();
  e.questions[0].body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "formula", attrs: { latex: "\\frac{" } }],
      },
    ],
  };
  assert.ok(validateForExport(e).some((x) => x.includes("فرمول")));
  e.layout.target = "-20";
  assert.ok(!validateForExport(e).some((x) => x.includes("نمره هدف")));
  assert.ok(!("target" in examSchema.parse(e).layout));
});
test("teacher-entered text is escaped, not interpreted as markup", async () => {
  const e = exampleExam();
  e.meta.title = "<script>alert(1)</script>";
  e.questions[0].answer = "<img src=x onerror=alert(1)>";
  const html = await renderToString(
    createSSRApp({
      render: () => h(PrintDocument, { exam: e, kind: "answer-key" }),
    }),
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;img"));
});
test("print styles and writing space preserve old exams", async () => {
  assert.equal(
    printStyles.filter((style) => style.mode === "monochrome").length,
    10,
  );
  assert.equal(
    printStyles.filter((style) => style.mode === "colorful").length,
    10,
  );
  const old = exampleExam();
  delete old.layout.style;
  delete old.questions[0].answerSpace;
  assert.equal(examSchema.safeParse(old).success, true);
  const exam = exampleExam();
  exam.layout.style = "cards";
  exam.questions[0].answerSpace = 2;
  exam.questions[0].body.content[0].content.push({
    type: "blank",
    attrs: { width: 120 },
  });
  assert.equal(examSchema.safeParse(exam).success, true);
  const html = await renderToString(
    createSSRApp({ render: () => h(PrintDocument, { exam, kind: "student" }) }),
  );
  assert.match(html, /style-cards/);
  assert.equal((html.match(/response-line/g) || []).length, 7);
  assert.match(html, /inline-blank/);
});
test("guest image sources are bounded and excluded from owned assets", () => {
  const exam = exampleExam();
  exam.meta.logo = "data:image/webp;base64,UklGRg==";
  assert.equal(examSchema.safeParse(exam).success, true);
  assert.deepEqual(assetIds(exam), []);
  assert.deepEqual(embeddedImages(exam), [exam.meta.logo]);
  exam.meta.logo = "data:image/svg+xml;base64,PHN2Zz4=";
  assert.equal(examSchema.safeParse(exam).success, false);
});
