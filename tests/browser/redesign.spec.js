import { test, expect } from "@playwright/test";
test("public landing and pricing fit phone and desktop without workspace navigation", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "از فکرِ سؤال",
    );
    await expect(page.locator(".sidebar")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "حرفه‌ای هوشمند", exact: true }),
  ).toBeVisible();
});
test("OTP accepts Persian pasted digits and keyboard correction", async ({
  page,
}) => {
  await page.route("**/api/auth/otp/request", (r) =>
    r.fulfill({
      json: { challengeId: "test", retryAfter: 60, expiresIn: 300 },
    }),
  );
  await page.goto("/account");
  await page.getByLabel("شماره همراه", { exact: true }).fill("09123456789");
  await page
    .getByRole("checkbox", { name: "حریم خصوصی و شرایط استفاده را می‌پذیرم" })
    .check();
  await page
    .getByRole("button", { name: "دریافت کد ورود", exact: true })
    .click();
  const first = page.getByLabel("کد شش‌رقمی", { exact: true });
  await first.fill("۱۲۳۴۵۶");
  await expect(page.getByLabel("رقم 6", { exact: true })).toHaveValue("6");
  await page.getByLabel("رقم 3", { exact: true }).focus();
  await page.keyboard.press("Backspace");
  await expect(page.getByLabel("رقم 3", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("رقم 4", { exact: true })).toHaveValue("4");
});
test("mobile navigation, original templates and visual math remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account");
  await page.getByRole("button", { name: "ایمیل", exact: true }).click();
  const identifier = `design-${Date.now()}@example.com`;
  await page.getByLabel("ایمیل", { exact: true }).fill(identifier);
  await page
    .getByRole("checkbox", { name: "حریم خصوصی و شرایط استفاده را می‌پذیرم" })
    .check();
  await page
    .getByRole("button", { name: "دریافت کد ورود", exact: true })
    .click();
  await expect(page.getByLabel("کد شش‌رقمی", { exact: true })).toBeVisible();
  const { code } = await (
    await page.request.get("/api/__test/otp", { params: { identifier } })
  ).json();
  await page.getByLabel("کد شش‌رقمی", { exact: true }).fill(code);
  await page.getByRole("button", { name: "تأیید و ادامه" }).click();
  const teacherName = page.getByLabel("نام و نام خانوادگی", { exact: true });
  await expect(teacherName).toHaveValue("");
  await teacherName.fill("سارا احمدی");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("navigation", { name: "ناوبری تلفن همراه" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await expect(page.locator(".mobile-question-navigation")).toBeVisible();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await expect(page.locator(".style-gallery .style-choice")).toHaveCount(10);
  await page.locator(".style-choice-academic").click();
  await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(page.locator(".paper-preview .print-document")).toHaveAttribute(
    "data-style",
    "academic",
  );
  await page
    .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
    .click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await page
    .locator(".rich-editor")
    .first()
    .getByRole("button", { name: "فرمول", exact: true })
    .click();
  const dialog = page.locator(".formula-dialog");
  await expect(dialog.locator("math-field")).toBeVisible();
  await dialog.locator("math-field").evaluate((el) => {
    el.value = "x^2+1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await dialog
    .getByRole("button", { name: "LaTeX پیشرفته", exact: true })
    .click();
  await expect(dialog.getByLabel("فرمول LaTeX", { exact: true })).toHaveValue(
    "x^2+1",
  );
  await dialog.getByRole("button", { name: "درج فرمول", exact: true }).click();
  await expect(
    page.locator(".rich-editor").first().locator(".formula"),
  ).toBeVisible();
});
