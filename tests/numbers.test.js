import { test } from "node:test";
import assert from "node:assert/strict";
import {
  englishDigits,
  persianDigits,
} from "../apps/frontend/src/lib/numbers.js";
test("credential digits normalize Persian, Arabic and mixed input without changing identifiers", () => {
  assert.equal(englishDigits("۰۹۱٢۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(englishDigits("۰1٢۳4۵"), "012345");
  assert.equal(englishDigits("+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹"), "+98 (912) 345-6789");
  assert.equal(englishDigits("teacher@example.com"), "teacher@example.com");
});
test("Persian display formatting preserves punctuation and does not mutate numeric values", () => {
  assert.equal(persianDigits("12.25"), "۱۲.۲۵");
  assert.equal(persianDigits("01"), "۰۱");
  assert.equal(persianDigits(null), "");
  assert.equal(persianDigits(0), "۰");
});
