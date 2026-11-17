import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { drawingPreset, drawingSchema } from "@exam/shared/drawing.js";
import {
  exampleExam,
  parseExam,
  validateForExport,
} from "@exam/shared/exam.js";
import PrintDocument from "@exam/shared/PrintDocument.js";
import { fontFamily, customFontCss } from "@exam/shared/fonts.js";
import { addMonth } from "../apps/backend/src/modules/billing/catalog.js";
import { normalizeIdentifier } from "../apps/backend/src/modules/auth/service.js";
test("calendar-month periods preserve the purchase anchor through short months and leap years", () => {
  const anchor = new Date("2024-01-31T12:30:00Z");
  assert.equal(addMonth(anchor).toISOString(), "2024-02-29T12:30:00.000Z");
  assert.equal(addMonth(anchor, 2).toISOString(), "2024-03-31T12:30:00.000Z");
  assert.equal(
    addMonth(new Date("2025-01-31T00:00:00Z")).toISOString(),
    "2025-02-28T00:00:00.000Z",
  );
});
test("identifiers normalize phone formats and email case without accepting arbitrary international numbers", () => {
  for (const value of [
    "۰۹۱۲۳۴۵۶۷۸۹",
    "09123456789",
    "+98 912 345 6789",
    "00989123456789",
  ])
    assert.deepEqual(normalizeIdentifier(value), {
      field: "phone",
      value: "+989123456789",
    });
  assert.deepEqual(normalizeIdentifier(" Teacher@Example.COM "), {
    field: "email",
    value: "teacher@example.com",
  });
  assert.throws(() => normalizeIdentifier("+14155551234"));
  assert.throws(() => normalizeIdentifier({ email: "a@b.com" }));
});
test("scientific presets validate, remain editable JSON, and render safe inline SVG", async () => {
  for (const name of ["force", "incline", "circuit"]) {
    const drawing = drawingPreset(name, randomUUID);
    assert.ok(drawingSchema.safeParse(drawing).success);
    drawing.shapes[0].label = "<script>alert(1)</script>";
    const exam = exampleExam();
    exam.questions[0].body = {
      type: "doc",
      content: [{ type: "drawing", attrs: { drawing } }],
    };
    const parsed = parseExam(exam);
    assert.deepEqual(validateForExport(parsed), []);
    const html = await renderToString(
      createSSRApp({
        render: () => h(PrintDocument, { exam: parsed, kind: "student" }),
      }),
    );
    assert.ok(html.includes("<svg"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  }
});
test("drawing schema rejects arbitrary shapes, scripts, nonfinite positions and excessive complexity", () => {
  const drawing = drawingPreset("force", randomUUID);
  for (const change of [
    { kind: "script" },
    { x: Infinity },
    { label: "a".repeat(121) },
    { onclick: "alert(1)" },
  ]) {
    const altered = structuredClone(drawing);
    Object.assign(altered.shapes[0], change);
    assert.equal(drawingSchema.safeParse(altered).success, false);
  }
  drawing.shapes = Array.from({ length: 101 }, () => ({
    ...drawing.shapes[0],
    id: randomUUID(),
  }));
  assert.equal(drawingSchema.safeParse(drawing).success, false);
});
test("font references are allowlisted and old documents retain their default font", () => {
  const exam = exampleExam();
  delete exam.layout.fontFamily;
  assert.equal(parseExam(exam).layout.fontFamily, "b-nazanin");
  exam.layout.fontFamily = "vazirmatn";
  assert.equal(parseExam(exam).layout.fontFamily, "vazirmatn");
  exam.layout.fontFamily = "evil;src:url(https://bad.invalid)";
  assert.throws(() => parseExam(exam));
  assert.equal(customFontCss(exam.layout.fontFamily), "");
  assert.equal(fontFamily(exam.layout.fontFamily), "B Nazanin");
  const css = customFontCss(randomUUID());
  assert.match(css, /font-weight:400/);
  assert.ok(!css.includes("100 900"));
});
