import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("admin bootstrap, green theme, user details and responsive layout", async ({
  page,
}) => {
  await page.goto("/eadamine");
  await page
    .getByLabel("ایمیل یا شماره همراه")
    .fill(randomUUID() + "@example.com");
  await page
    .getByRole("button", { name: "دریافت کد ورود", exact: true })
    .click();
  const identifier = await page.getByLabel("ایمیل یا شماره همراه").inputValue();
  const { code } = await (
    await page.request.get("/api/__test/otp", { params: { identifier } })
  ).json();
  await page.getByLabel("کد شش‌رقمی").fill(code);
  await page.getByRole("button", { name: "تأیید و ورود", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "نمای کلی", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "کاربران", exact: true }).click();
  await page.getByLabel("جست‌وجوی نام، ایمیل یا تلفن").fill(identifier);
  await page.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await page.getByRole("button", { name: "جزئیات", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "مدیریت دسترسی اشتراک" }),
  ).toBeVisible();
  await page.getByLabel("نام", { exact: true }).fill("مدیر آزمون");
  await page.getByLabel("دلیل تغییر (الزامی)").fill("تکمیل مشخصات");
  await page.getByRole("button", { name: "ذخیره مشخصات" }).click();
  await expect(
    page.getByRole("heading", { name: "مدیر آزمون", exact: true }),
  ).toBeVisible();
  for (const width of [360, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
  await expect(
    page.locator(".admin-user-table .admin-person").first(),
  ).toContainText("تلفن ثبت نشده");
  await expect(page.locator(".admin-pagination .v-pagination")).toBeVisible();
  await page
    .getByRole("link", { name: "رویدادهای مدیریت", exact: true })
    .click();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const fields = page.locator(
      ".admin-audit-filters > .labeled-field, .admin-audit-filters > .admin-datetime-field",
    );
    for (let i = 0; i < (await fields.count()); i++)
      expect((await fields.nth(i).boundingBox()).width).toBeGreaterThan(170);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(
    page.locator(".admin-table .admin-person").first(),
  ).toContainText("مدیر آزمون");
  await page.getByLabel("از تاریخ", { exact: true }).click();
  await expect(
    page.locator(".vpd-content").filter({ visible: true }),
  ).toBeVisible();
  await page
    .locator(".vpd-content")
    .filter({ visible: true })
    .locator(".vpd-actions button")
    .first()
    .click();
  await page
    .locator(".vpd-content")
    .filter({ visible: true })
    .locator(".vpd-actions button")
    .first()
    .click();
  await expect(page.getByLabel("از تاریخ", { exact: true })).not.toHaveValue(
    "",
  );
  const filterRequest = page.waitForRequest(
    (req) =>
      req.url().includes("/api/admin/audit?") &&
      new URL(req.url()).searchParams.has("from"),
  );
  await page.getByRole("button", { name: "اعمال فیلتر", exact: true }).click();
  const sent = new URL((await filterRequest).url()).searchParams.get("from");
  expect(sent).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  await page.getByLabel("از تاریخ", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".vpd-content").filter({ visible: true }),
  ).toHaveCount(0);
  await page
    .locator(".admin-datetime-field")
    .first()
    .locator(".v-field__clearable .v-icon")
    .click();
  await expect(page.getByLabel("از تاریخ", { exact: true })).toHaveValue("");
  await page.screenshot({
    path: "test-results/admin-audit-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/admin-audit-mobile.png",
    fullPage: true,
  });
});
