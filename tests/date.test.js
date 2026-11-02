import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, convertDate } from "../shared/date.js";
test("strict optional dates, leap days and calendar conversion", () => {
  assert.ok(parseDate("۱۳۹۹/۱۲/۳۰", "jalali"));
  assert.equal(parseDate("1400/12/30", "jalali"), null);
  assert.ok(parseDate("2024/02/29", "gregorian"));
  assert.equal(parseDate("2023/02/29", "gregorian"), null);
  assert.equal(parseDate("2024/2/29", "gregorian"), null);
  assert.equal(convertDate("۱۴۰۳/۰۱/۰۱", "jalali", "gregorian"), "2024/03/20");
  assert.equal(convertDate("2024/03/20", "gregorian", "jalali"), "1403/01/01");
  for (const text of ["", "legacy date", "1400/12/30"])
    assert.equal(convertDate(text, "jalali", "gregorian"), text);
});
