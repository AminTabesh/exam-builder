import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { matchingQuestion } from "../fixtures/matching.js";
import { exampleExam } from "@exam/shared/exam.js";
async function login(page) {
  const identifier = `matching-${randomUUID()}@example.com`;
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
  await page
    .getByRole("button", { name: "تأیید و ادامه", exact: true })
    .click();
  const teacherName = page.getByLabel("نام و نام خانوادگی", { exact: true });
  await expect(teacherName).toHaveValue("");
  await teacherName.fill("سارا احمدی");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
}
async function create(page) {
  const document = exampleExam();
  document.questions = [matchingQuestion()];
  const response = await page.request.post("/api/exams", {
    data: { document },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id;
}
test("information comes first, preview remains in all steps, and desktop menu toggles", async ({
  page,
}, info) => {
  await login(page);
  await page
    .getByRole("button", { name: "شروع با آزمون نمونه", exact: true })
    .click();
  await expect(page.getByLabel("عنوان آزمون *", { exact: true })).toBeVisible();
  for (const name of [
    "مشخصات و قالب برگه",
    "سؤال‌ها و ویرایش",
    "بازبینی و دریافت PDF",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    if (info.project.name === "mobile") {
      await page
        .getByRole("button", { name: "پیش‌نمایش", exact: true })
        .click();
      await expect(
        page.getByRole("dialog").locator(".exam-page").first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
        .last()
        .click();
    } else {
      await expect(
        page.locator(".preview-column .exam-page").first(),
      ).toBeVisible();
    }
  }
  if (info.project.name !== "mobile") {
    const preview = page.locator("#exam-preview-content");
    const previewBox = await preview.boundingBox();
    const editorBox = await page.locator(".editor-column").boundingBox();
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(editorBox.x);
    await page
      .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
      .click();
    await expect(preview).toBeHidden();
    await page
      .getByRole("button", { name: "نمایش پیش‌نمایش", exact: true })
      .click();
    await expect(preview).toBeVisible();
    expect(
      await page
        .locator(".preview-column")
        .evaluate((el) => getComputedStyle(el).position),
    ).toBe("sticky");
  }
  await page.getByRole("button", { name: "مرحله قبل", exact: true }).click();
  await expect(page.locator(".questions-panel")).toBeVisible();
  await page.getByRole("button", { name: "مرحله بعد", exact: true }).click();
  await expect(page.locator(".review-panel")).toBeVisible();
  if (info.project.name === "chromium") {
    const toggle = page.getByRole("button", {
      name: "بستن منوی اصلی",
      exact: true,
    });
    await toggle.click();
    await expect(page.locator(".workspace-shell")).toHaveClass(
      /menu-collapsed/,
    );
    await expect(
      page.getByRole("link", { name: "آزمون‌های من", exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "باز کردن منوی اصلی", exact: true })
      .click();
    await expect(page.locator(".workspace-shell")).not.toHaveClass(
      /menu-collapsed/,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("matching supports unequal columns, rich editing, save/reload, removal and answer-key export", async ({
  page,
}, info) => {
  await login(page);
  const id = await create(page);
  await page.goto("/exam/" + id);
  const phone = (page.viewportSize()?.width || 1440) < 768;
  if (phone)
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(
    page.locator(".paper-preview .print-pages .matching-print-board"),
  ).toBeVisible();
  await expect(
    page.locator(
      ".paper-preview .print-pages .matching-print-left .matching-print-item",
    ),
  ).toHaveCount(2);
  await expect(
    page.locator(
      ".paper-preview .print-pages .matching-print-right .matching-print-item",
    ),
  ).toHaveCount(3);
  await expect(
    page.locator(".paper-preview .print-pages .matching-connections"),
  ).toHaveCount(0);
  await expect(page.locator(".paper-preview .print-pages .katex")).toHaveCount(
    1,
  );
  if (phone)
    await page
      .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
      .click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  const editor = page.locator(".matching-editor");
  await editor.locator(".tiptap").first().fill("ویرایش مورد اول");
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await expect(editor.locator(".tiptap").first()).toHaveText("ویرایش مورد اول");
  await editor
    .getByRole("button", { name: "افزودن مورد به ستون دوم", exact: true })
    .click();
  await editor.locator(".tiptap").last().fill("مورد اضافی جدید");
  await editor
    .getByRole("button", { name: "حذف مورد الف از ستون دوم", exact: true })
    .click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const stored = await (await page.request.get("/api/exams/" + id)).json();
  expect(stored.document.questions[0].matching.pairs).toHaveLength(1);
  await page
    .getByRole("button", { name: "بازبینی و دریافت PDF", exact: true })
    .click();
  await page
    .getByRole("button", { name: "پاسخ‌نامه مدرس", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "دریافت PDF", exact: true }).click();
  await (await download).saveAs(info.outputPath("matching-answer-key.pdf"));
});
test("AI generates matching drafts with formulas, unequal columns and correct pairs", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "شروع با آزمون نمونه", exact: true })
    .click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  const order = await (
    await page.request.post("/api/billing/checkout", {
      data: { planId: "professional-ai", idempotencyKey: randomUUID() },
    })
  ).json();
  await page.request.post(`/api/billing/orders/${order.id}/mock-confirm`);
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  await page.getByLabel("موضوع یا فصل درس", { exact: true }).fill("ضرب اعداد");
  await page
    .getByRole("button", { name: "ادامه؛ تنظیم سؤال‌ها", exact: true })
    .click();
  await page.getByLabel("تعداد سؤال چندگزینه‌ای", { exact: true }).fill("0");
  await page.getByLabel("تعداد سؤال وصل‌کردنی", { exact: true }).fill("۱");
  await page
    .getByRole("checkbox", {
      name: "با ارسال متن و تنظیمات این درخواست به Groq موافقم",
    })
    .check();
  await page
    .getByRole("button", { name: "تولید سؤال‌ها", exact: true })
    .click();
  await expect(page.locator(".ai-draft")).toHaveCount(1);
  await expect(page.locator(".ai-draft .matching-edit-item")).toHaveCount(5);
  const bounds = await page
    .locator(".ai-dialog > .v-card-text")
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      const last = el.querySelector(".ai-review > p");
      return {
        gap:
          el.getBoundingClientRect().bottom -
          last.getBoundingClientRect().bottom,
        height: el.scrollHeight,
      };
    });

  expect(bounds.gap).toBeLessThan(45);

  await page
    .getByRole("button", { name: "افزودن سؤال‌های انتخابی", exact: true })
    .click();
  if ((page.viewportSize()?.width || 1440) < 768) {
    await page.locator(".mobile-question-navigation > button").nth(1).click();
    await expect(
      page
        .getByRole("list", { name: "سؤال‌های آزمون" })
        .locator(".v-list-item"),
    ).toHaveCount(4);
    await page
      .getByRole("button", { name: "بازگشت به ویرایش", exact: true })
      .click();
  } else await expect(page.locator(".studio-outline>button")).toHaveCount(5);
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const exams = await (await page.request.get("/api/exams")).json();
  const q = exams[0].document.questions.at(-1);
  expect(q.type).toBe("matching");
  expect(q.matching.left).toHaveLength(2);
  expect(q.matching.right).toHaveLength(3);
  expect(q.matching.pairs).toHaveLength(2);
});
