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
} from "../shared/exam.js";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import PrintDocument from "../shared/PrintDocument.js";
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
