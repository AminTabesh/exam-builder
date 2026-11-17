import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function sample(page) {
  const identifier = `${randomUUID()}@example.com`;
  await page.goto("/account");
  await page.getByRole("button", { name: "ایمیل", exact: true }).click();
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
  await page
    .getByLabel("نام و نام خانوادگی", { exact: true })
    .fill("مدرس آزمون");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await expect(page.getByLabel("عنوان آزمون *")).toBeVisible();
  return identifier;
}
test("phone workflows fit 360–430px and keep one question editor with full screen preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await sample(page);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await expect(page.locator(".question-card")).toHaveCount(1);
  await page.getByRole("button", { name: "افزودن", exact: true }).click();
  await page
    .locator(".mobile-add-types")
    .getByRole("button", { name: /تشریحی/ })
    .click();
  await expect(page.locator(".question-card")).toHaveCount(1);
  await expect(page.getByLabel("سؤال بعد", { exact: true })).toBeDisabled();
  await page.getByLabel("سؤال قبل", { exact: true }).click();
  await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "کنترل پیش‌نمایش" }),
  ).toBeVisible();
  await page.getByLabel("بزرگ‌نمایی", { exact: true }).click();
  await page.getByLabel("نوع برگه", { exact: true }).selectOption("answer-key");
  await page
    .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/mobile-editor.png",
    fullPage: true,
  });
});
test("downloaded exam reopens after server loss and reload, then syncs without losing offline edits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page);
  const url = page.url();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const r = indexedDB.open("azmoon-offline");
          r.onsuccess = () => resolve(r.result);
          r.onerror = reject;
        });
        return await new Promise((resolve) => {
          const r = db.transaction("exams").objectStore("exams").count();
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        });
      }),
    )
    .toBeGreaterThan(0);
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  await page.reload();
  const title = page.getByLabel("عنوان آزمون *");
  await expect(title).toBeVisible();
  await title.fill("ویرایش محفوظ آفلاین");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise((resolve) => {
          const r = indexedDB.open("azmoon-offline");
          r.onsuccess = () => resolve(r.result);
        });
        return await new Promise((resolve) => {
          const r = db.transaction("drafts").objectStore("drafts").getAll();
          r.onsuccess = () => {
            resolve(r.result[0]?.document.meta.title);
            db.close();
          };
        });
      }),
    )
    .toBe("ویرایش محفوظ آفلاین");
  await page.reload();
  await expect(title).toHaveValue("ویرایش محفوظ آفلاین");
  await page.unroute("**/api/**");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const retry = page.getByRole("button", { name: "تلاش دوباره", exact: true });
  if (await retry.isVisible()) await retry.click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const row = await (
    await page.request.get(`/api/exams/${url.split("/").pop()}`)
  ).json();
  expect(row.document.meta.title).toBe("ویرایش محفوظ آفلاین");
});

test("storage failure never reports an offline draft as saved or silently leaves the editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page);
  const url = page.url();
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "drafts")
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.apply(this, args);
    };
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByLabel("عنوان آزمون *").fill("نسخه هنوز ذخیره نشده");
  await expect(page.locator(".save-status")).toContainText("ذخیره انجام نشد");
  await page
    .getByRole("navigation", { name: "ناوبری تلفن همراه" })
    .getByRole("link", { name: "آزمون‌ها", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  await expect(
    page.getByText("ذخیره آزمون انجام نشد. پیش از خروج، دوباره ذخیره کنید.", {
      exact: true,
    }),
  ).toBeVisible();
});
