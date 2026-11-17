import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formulaGroups,
  templateLatex,
} from "../apps/frontend/src/features/exams/formulaTemplates.js";
import { renderFormula } from "../packages/shared/math.js";

test("expanded formula catalog has unique labels, editable slots and valid previews", () => {
  const labels = new Set();
  const items = formulaGroups.flatMap((group) => group.items);
  assert.ok(items.length >= 190);
  for (const item of items) {
    assert.ok(!labels.has(item.label), item.label);
    labels.add(item.label);
    const keys = new Set(item.fields.map((field) => field.key));
    for (const match of item.code.matchAll(/[{][{](\w+)[}][}]/g))
      assert.ok(keys.has(match[1]), `${item.label}: ${match[1]}`);
    assert.ok(renderFormula(templateLatex(item)).includes("katex"), item.label);
    assert.ok(
      renderFormula(
        templateLatex(
          item,
          Object.fromEntries(item.fields.map((field) => [field.key, "x"])),
        ),
      ).includes("katex"),
      item.label,
    );
  }
  assert.equal(
    items.find((item) => item.label === "دلتا").code,
    String.raw`\Delta`,
  );
  assert.equal(
    items.find((item) => item.label === "دلتا کوچک").code,
    String.raw`\delta`,
  );
});
