import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("installed production shell and downloaded exam survive a genuinely offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/privacy");
  const identifier = `${randomUUID()}@example.com`;
  const { challengeId } = await (
    await page.request.post("/api/auth/otp/request", {
      data: { identifier, privacyConsent: "2026-11-15" },
    })
  ).json();
  const { code } = await (
    await page.request.get("/api/__test/otp", { params: { identifier } })
  ).json();
  await page.request.post("/api/auth/otp/verify", {
    data: { challengeId, code, name: "مدرس آفلاین" },
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  const title = page.getByLabel("عنوان آزمون *");
  await expect(title).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await expect(title).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(title).toHaveValue("آزمون میان‌ترم ریاضی");
  await title.fill("پیش‌نویس کاملاً آفلاین");
  await expect(page.locator(".save-status")).toContainText(
    "آفلاین؛ ذخیره روی دستگاه",
  );
  await page.waitForFunction(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open("azmoon-offline");
      r.onsuccess = () => resolve(r.result);
    });
    return await new Promise((resolve) => {
      const r = db.transaction("drafts").objectStore("drafts").getAll();
      r.onsuccess = () => {
        resolve(
          r.result.some(
            (row) => row.document.meta.title === "پیش‌نویس کاملاً آفلاین",
          ),
        );
        db.close();
      };
    });
  });
  await page.reload();
  await expect(title).toHaveValue("پیش‌نویس کاملاً آفلاین");
  await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(page.locator(".paper-preview .exam-page").first()).toBeVisible();
  await page
    .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
    .click();
  await expect(page.locator(".v-overlay__scrim:visible")).toHaveCount(0);
  await page.screenshot({ path: "test-results/production-offline.png" });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
});
