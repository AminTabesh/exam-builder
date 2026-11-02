import { test, expect } from "@playwright/test";
import { exampleExam, newQuestion, paragraph } from "../../shared/exam.js";
async function sample(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue(
    "آزمون میان‌ترم ریاضی",
  );
}
test("first-time guest walkthrough, error correction, edit, undo and PDF", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "ساخت آزمون جدید", exact: true })
    .click();
  await page.getByRole("button", { name: "ادامه؛ افزودن سؤال‌ها" }).click();
  await expect(
    page.getByText("عنوان آزمون را بنویسید.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("عنوان آزمون *").fill("آزمون علوم");
  await page.getByLabel("نام درس *").fill("علوم تجربی");
  await page.getByRole("button", { name: "ادامه؛ افزودن سؤال‌ها" }).click();
  await page.getByRole("button", { name: /تشریحی.*افزودن/ }).click();
  await page
    .getByRole("textbox", { name: "متن سؤال", exact: true })
    .fill("چرخه آب را توضیح دهید.");
  await page.getByLabel("نمره سؤال").fill("20");
  await page.getByRole("button", { name: "حذف سؤال", exact: true }).click();
  await page.getByRole("button", { name: "بازگرداندن" }).click();
  await expect(
    page.getByRole("textbox", { name: "متن سؤال", exact: true }),
  ).toContainText("چرخه آب");
  await page.getByRole("button", { name: "ادامه؛ بازبینی آزمون" }).click();
  await page.getByRole("button", { name: "بازبینی PDF و دریافت برگه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 45000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "دریافت PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".pdf");
  await download.saveAs(testInfo.outputPath("exam.pdf"));
  expect(errors).toEqual([]);
});
test("dashboard desktop/mobile, autosave, keyboard and duplication", async ({
  page,
}, testInfo) => {
  await sample(page);
  await page.getByLabel("عنوان آزمون *").fill("آزمون نیم‌فاصله");
  await expect(
    page.getByText("ذخیره‌شده در این مرورگر", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue("آزمون نیم‌فاصله");
  await page
    .getByRole("link", { name: "آزمون‌های من", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "گزینه‌های آزمون نیم‌فاصله" }).click();
  await page.getByText("ساخت کپی", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "آزمون نیم‌فاصله (کپی)" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => document.activeElement !== document.body),
  ).toBe(true);
});
test("pagination, formula, manual break, closing once and no overflow", async ({
  page,
}, testInfo) => {
  const exam = exampleExam();
  exam.questions[1].pageBreak = true;
  exam.questions.push({
    ...newQuestion(),
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "نیم‌فاصله و English: " },
            { type: "formula", attrs: { latex: "x^2+\\frac{1}{2}" } },
          ],
        },
        ...Array.from(
          { length: 30 },
          () =>
            paragraph("این یک بند بلند برای آزمون صفحه‌بندی است. ".repeat(4))
              .content[0],
        ),
      ],
    },
    lines: 20,
  });
  await page.goto("/");
  await page.evaluate((document) => {
    localStorage.setItem(
      "azmoon-demo",
      JSON.stringify([
        {
          id: "pagination",
          revision: 1,
          document,
          updated_at: new Date().toISOString(),
        },
      ]),
    );
  }, exam);
  await page.goto("/exam/pagination");
  if (testInfo.project.name === "mobile")
    await page
      .getByRole("button", { name: "پیش‌نمایش برگه", exact: true })
      .click();
  await expect(page.locator(".print-pages .exam-page").first()).toBeVisible();
  await expect
    .poll(() => page.locator(".print-pages .exam-page").count())
    .toBeGreaterThan(2);
  await expect(page.locator(".print-pages .exam-closing")).toHaveCount(1);
  expect(
    await page
      .locator(".print-pages .page-body")
      .evaluateAll((nodes) =>
        nodes.every((n) => n.scrollHeight <= n.clientHeight + 1),
      ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("pagination.png"),
    fullPage: true,
  });
});
test("stale local revision preserves edits and offers copy", async ({
  page,
}) => {
  await sample(page);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("azmoon-demo"));
    rows[0].revision++;
    localStorage.setItem("azmoon-demo", JSON.stringify(rows));
  });
  await page.getByLabel("عنوان آزمون *").fill("نسخه من");
  await expect(
    page.getByRole("button", { name: "ساخت کپی از تغییرات من" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ساخت کپی از تغییرات من" }).click();
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue("نسخه من");
});
test("compact navigation and repeated Sortable teardown preserve questions", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await sample(page);
  for (const width of [320, 390, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.locator(width < 600 ? ".mobile-steps" : ".builder-stepper"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`builder-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "ادامه؛ افزودن سؤال‌ها" }).click();
    await expect(
      page.getByRole("textbox", { name: "متن سؤال", exact: true }),
    ).toHaveCount(3);
    await page.getByRole("button", { name: "مرحله قبل" }).focus();
    await page.keyboard.press("Enter");
  }
  expect(errors).toEqual([]);
});
test("date picker opens by keyboard, dismisses and returns focus", async ({
  page,
}, info) => {
  await sample(page);
  const field = page.getByLabel("تاریخ آزمون (اختیاری)");
  await field.focus();
  await field.press("Enter");
  await expect(page.locator(".vpd-container")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("date-picker.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".vpd-container")).not.toBeVisible();
  await expect(field).toBeFocused();
});
