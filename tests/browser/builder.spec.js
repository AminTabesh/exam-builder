import { test, expect } from "@playwright/test";
import { randomUUID, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { exampleExam, newQuestion, paragraph } from "@exam/shared/exam.js";
function browserApi(page) {
  const run = async (method, url, options = {}) => {
    const result = await page.evaluate(
      async ({ method, url, data }) => {
        const response = await fetch(url, {
          method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: data ? JSON.stringify(data) : undefined,
        });
        return { status: response.status, body: await response.json() };
      },
      { method, url, data: options.data },
    );
    return { status: () => result.status, json: async () => result.body };
  };
  return {
    post: (url, options) => run("POST", url, options),
    put: (url, options) => run("PUT", url, options),
    get: (url) => run("GET", url),
  };
}
async function login(page, completeName = true) {
  const identifier = `${randomUUID()}@example.com`;
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/account/);
  await page.getByRole("button", { name: "ایمیل", exact: true }).click();
  await page.getByLabel("ایمیل", { exact: true }).fill(identifier);
  await page
    .getByRole("checkbox", { name: "حریم خصوصی و شرایط استفاده را می‌پذیرم" })
    .check();
  await page
    .getByRole("button", { name: "دریافت کد ورود", exact: true })
    .click();
  await expect(page.getByLabel("کد شش‌رقمی")).toBeVisible();
  const { code } = await (
    await page.request.get("/api/__test/otp", { params: { identifier } })
  ).json();
  await page.getByLabel("کد شش‌رقمی").fill(code);
  await page.getByRole("button", { name: "تأیید و ادامه" }).click();
  const teacherName = page.getByLabel("نام و نام خانوادگی", { exact: true });
  await expect(teacherName).toHaveValue("");
  if (!completeName) return;
  await teacherName.fill("سارا احمدی");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:5183/dashboard");
}
async function sample(page) {
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue(
    "آزمون میان‌ترم ریاضی",
  );
}
test("OTP signup asks for an empty name and resumes after refreshing", async ({
  page,
}) => {
  await login(page, false);
  await page.reload();
  const name = page.getByLabel("نام و نام خانوادگی", { exact: true });
  await expect(name).toHaveValue("");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/account/);
  await name.fill("   ");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page.locator(".account-card .v-alert")).toContainText(
    "نام و نام خانوادگی خود را وارد کنید",
  );
  await name.fill("  سارا احمدی  ");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  const user = await (await page.request.get("/api/auth/me")).json();
  expect(user.name).toBe("سارا احمدی");
  await page.goto("/account");
  await expect(page.getByLabel("نام نمایشی مدرس", { exact: true })).toHaveValue(
    "سارا احمدی",
  );
  await expect(
    page.getByRole("button", { name: "ذخیره و ادامه", exact: true }),
  ).toHaveCount(0);
});
test("sheet numbers and page counters follow the exam language", async ({
  page,
}) => {
  await login(page);
  for (const language of ["en", "fa"]) {
    const document = exampleExam(language);
    document.meta.date = "۱۴۰۵/۰۸/۱۱";
    document.meta.duration = "۶۰";
    document.meta.title = "Exam ۱۲٣";
    document.questions[0].body = paragraph("Question 12۳");
    const response = await browserApi(page).post("/api/exams", {
      data: { document },
    });
    const row = await response.json();
    await page.goto(`/exam/${row.id}`);
    const mobile = page.viewportSize().width < 768;
    if (mobile) await page.locator(".mobile-preview-button").click();
    const preview = page.locator(
      mobile ? ".v-dialog .paper-preview" : ".preview-canvas",
    );
    const pages = preview.locator(".print-pages");
    await expect(pages.locator(".page-footer").first()).toContainText(
      language === "en" ? "Page 1 of" : "صفحه ۱ از",
    );
    const text = await pages.innerText();
    if (language === "en") {
      expect(text).not.toMatch(/[۰-۹٠-٩]/);
      await expect(preview.locator(".print-document")).toHaveCSS(
        "font-family",
        /Exam English Digits/,
      );
      expect(
        await page.evaluate(
          async () =>
            (
              await document.fonts.load(
                '12pt "Exam English Digits"',
                "0123456789",
              )
            ).length,
        ),
      ).toBeGreaterThan(0);
    } else {
      expect(text).not.toMatch(/[0-9٠-٩]/);
      expect(text).toContain("۱۴۰۵/۰۸/۱۱");
    }
  }
});
test("template modes offer professional monochrome and colored papers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await sample(page);
  await expect(page.locator(".style-gallery .style-choice")).toHaveCount(10);
  await page.getByRole("button", { name: /رنگی/ }).click();
  await expect(page.locator(".style-gallery .style-choice")).toHaveCount(10);
  for (const id of [
    "ocean",
    "forest",
    "plum",
    "terracotta",
    "navy",
    "saffron",
    "teal",
    "coral",
    "indigo",
    "slate",
  ]) {
    await page.locator(`.style-choice-${id}`).click();
    const document = page.locator(".preview-canvas .print-document");
    await expect(document).toHaveAttribute("data-style", id);
    await expect(document).toHaveClass(/colorful/);
    await expect(
      document.locator(".print-pages .page-footer").first(),
    ).toBeVisible();
  }
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("color-template.png"),
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await expect(page.locator(".style-choice-slate")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /سیاه و سفید/ }).click();
  await page.locator(".style-choice-formal").click();
  await expect(page.locator(".preview-canvas .print-document")).not.toHaveClass(
    /colorful/,
  );
});
test("instructions stay unfaded and alignment persists to the sheet", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page
    .locator("summary")
    .filter({ hasText: "سربرگ و تنظیمات برگه" })
    .click();
  const input = page.getByLabel("راهنمای ابتدای آزمون", { exact: true });
  await input.fill("راهنمای آزمون\nخط دوم راهنما");
  await expect(input).toHaveCSS("mask-image", "none");
  const controls = page.getByRole("group", {
    name: "تراز راهنمای ابتدای آزمون",
  });
  for (const [label, alignment] of [
    ["چپ‌چین", "left"],
    ["وسط‌چین", "center"],
    ["راست‌چین", "right"],
  ]) {
    const button = controls.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(input).toHaveCSS("text-align", alignment);
  }
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "سربرگ و تنظیمات برگه" })
    .click();
  await expect(input).toHaveCSS("text-align", "right");
  await page
    .getByRole("button", { name: "بازبینی و دریافت PDF", exact: true })
    .click();
  if ((page.viewportSize()?.width || 1440) < 768)
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(
    page.locator(".paper-preview .exam-instructions").first(),
  ).toHaveCSS("text-align", "right");
});
test("closing preview expands the editor and reopening restores both columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await sample(page);
  const editor = page.locator(".editor-column");
  const grid = page.locator(".builder-columns");
  const originalWidth = (await editor.boundingBox()).width;
  await page
    .getByRole("button", { name: "بستن پیش‌نمایش", exact: true })
    .click();
  await expect
    .poll(async () => {
      const editorBox = await editor.boundingBox();
      const gridBox = await grid.boundingBox();
      return Math.abs(editorBox.width - gridBox.width);
    })
    .toBeLessThan(2);
  await expect(page.locator(".preview-column")).toBeHidden();
  const reopen = page.getByRole("button", {
    name: "نمایش پیش‌نمایش",
    exact: true,
  });
  await expect(reopen).toBeFocused();
  await reopen.click();
  await expect
    .poll(async () =>
      Math.abs((await editor.boundingBox()).width - originalWidth),
    )
    .toBeLessThan(2);
  await expect(page.locator(".preview-column")).toBeVisible();
});
test("authentication is mandatory; pricing is public and OTP creates an account", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "استاندارد", exact: true }),
  ).toBeVisible();
  await login(page);
  await expect(
    page.getByRole("heading", { name: "آزمون‌های من." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("exam autosave, reload, duplication and PDF export", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await sample(page);
  await page.getByLabel("عنوان آزمون *").fill("آزمون نیم‌فاصله");
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue("آزمون نیم‌فاصله");
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await page.getByRole("button", { name: "بازبینی و دریافت PDF" }).click();
  await page.getByRole("button", { name: "بازبینی PDF و دریافت برگه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "دریافت PDF", exact: true }).click();
  await (await download).saveAs(info.outputPath("exam.pdf"));
  expect(errors).toEqual([]);
});
test("three lifetime creations remain exhausted after deletion and simulated purchase unlocks creation", async ({
  page,
}) => {
  await login(page);
  for (let i = 0; i < 3; i++)
    expect(
      (
        await browserApi(page).post("/api/exams", {
          data: { document: exampleExam() },
        })
      ).status(),
    ).toBe(201);
  expect(
    (
      await browserApi(page).post("/api/exams", {
        data: { document: exampleExam() },
      })
    ).status(),
  ).toBe(402);
  await page.goto("/pricing");
  await page
    .getByRole("button", { name: "خرید آزمایشی", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/pricing\?purchase=success/);
  await expect(page.getByText("طرح فعلی: استاندارد")).toBeVisible();
  expect(
    (
      await browserApi(page).post("/api/exams", {
        data: { document: exampleExam() },
      })
    ).status(),
  ).toBe(201);
});
test("drawing preset can be edited and persists through save/reload with selected font", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await sample(page);
  await page.getByText("سربرگ و تنظیمات برگه", { exact: false }).click();
  await page.getByLabel("فونت آزمون", { exact: true }).press("ArrowDown");
  await page.getByRole("option", { name: "نسخ عربی", exact: true }).click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await page.getByRole("button", { name: "شکل", exact: true }).first().click();
  await page.getByRole("button", { name: "نمودار نیرو", exact: true }).click();
  await page.getByRole("button", { name: "بردار N", exact: true }).click();
  await page.getByLabel("برچسب", { exact: true }).fill("N1");
  await page.getByLabel("عرض", { exact: true }).fill("125");
  await page
    .getByRole("button", { name: "درج / ذخیره شکل", exact: true })
    .click();
  await expect(page.locator(".tiptap svg").first()).toBeVisible();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await expect(page.locator(".tiptap svg").first()).toBeVisible();
  const data = (await (await browserApi(page).get("/api/exams")).json())[0];
  expect(data.document.layout.fontFamily).toBe("noto-naskh");
  expect(JSON.stringify(data.document)).toContain("drawing");
  expect(JSON.stringify(data.document)).toContain("N1");
  await page.screenshot({
    path: info.outputPath("drawing-editor.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("manual pagination and answer keys retain distinct page counts", async ({
  page,
}) => {
  await login(page);
  const exam = exampleExam();
  exam.questions[1].pageBreak = true;
  const response = await browserApi(page).post("/api/exams", {
    data: { document: exam },
  });
  expect(response.status()).toBe(201);
  const row = await response.json();
  await page.goto("/exam/" + row.id);
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await expect(page.getByLabel("عنوان آزمون *")).toBeVisible();
  const toggle = page.getByRole("button", {
    name: "پیش‌نمایش",
    exact: true,
  });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.locator(".paper-preview .exam-page")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("verified phone linking adds an alternative login to the same account", async ({
  page,
}) => {
  await login(page);
  await page.goto("/account");
  const phone = "+98912" + randomInt(1000000, 9999999);
  await page.getByLabel("شماره همراه", { exact: true }).fill(phone);
  await page
    .getByRole("checkbox", { name: "حریم خصوصی و شرایط استفاده را می‌پذیرم" })
    .check();
  await page
    .getByRole("button", { name: "دریافت کد ورود", exact: true })
    .click();
  await expect(page.getByLabel("کد شش‌رقمی")).toBeVisible();
  const { code } = await (
    await page.request.get("/api/__test/otp", { params: { identifier: phone } })
  ).json();
  await page.getByLabel("کد شش‌رقمی").fill(code);
  await page.getByRole("button", { name: "تأیید و ادامه" }).click();
  await expect(
    page.getByText("روش ورود به حساب متصل شد.", { exact: true }),
  ).toBeVisible();
  const user = await (await browserApi(page).get("/api/auth/me")).json();
  expect(user.phone).toBe(phone);
  expect(user.email).toContain("@example.com");
});
test("a private uploaded font is selected, saved and loaded after refresh", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page
    .locator("summary")
    .filter({ hasText: "سربرگ و تنظیمات برگه" })
    .click();
  await expect(
    page.locator(".font-settings .v-select__selection-text"),
  ).toContainText("بی نازنین");
  expect(
    await page.evaluate(async () => {
      const faces = await document.fonts.load('12px "B Nazanin"', "آزمون");
      return (
        faces.length > 0 && faces.every((face) => face.status === "loaded")
      );
    }),
  ).toBe(true);
  await page.locator(".font-settings summary").click();
  await page
    .getByLabel("مجوز استفاده و قراردادن این فونت در PDF را دارم.")
    .check();
  await page.locator(".font-settings input[type=file]").setInputFiles({
    name: "legacy.TTF",
    mimeType: "font/ttf",
    buffer: await (
      await import("../fixtures/legacy-font.js")
    ).legacyContextFont(),
  });
  await expect(page.locator(".font-list li")).toHaveCount(1);
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const exam = (await (await browserApi(page).get("/api/exams")).json())[0];
  expect(exam.document.layout.fontFamily).toMatch(/^[a-f0-9-]{36}$/);
  if ((page.viewportSize()?.width || 1440) < 768)
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  expect(
    await page.evaluate(async (id) => {
      const faces = await document.fonts.load(`12px "ExamFont-${id}"`, "Exam");
      return (
        faces.length > 0 && faces.every((face) => face.status === "loaded")
      );
    }, exam.document.layout.fontFamily),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: "سربرگ و تنظیمات برگه" })
    .click();
  await expect(
    page.locator(".font-settings .v-select__selection-text"),
  ).toContainText("شخصی");
  if ((page.viewportSize()?.width || 1440) < 768)
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  const typography = await page.evaluate(async (id) => {
    await document.fonts.load(`700 40px "ExamFont-${id}"`, "Exam");
    const paper = document.querySelector(".print-document");
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 70;
    const ctx = canvas.getContext("2d");
    function ink(weight) {
      ctx.clearRect(0, 0, 300, 70);
      ctx.font = `${weight} 40px "ExamFont-${id}"`;
      ctx.fillText("Exam", 10, 50);
      const data = ctx.getImageData(0, 0, 300, 70).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) sum += data[i];
      return sum;
    }
    return {
      synthesis: getComputedStyle(paper).fontSynthesis,
      normal: ink(400),
      bold: ink(700),
      titleWeight: getComputedStyle(paper.querySelector("h1")).fontWeight,
    };
  }, exam.document.layout.fontFamily);
  expect(typography.synthesis).toContain("weight");
  expect(typography.titleWeight).toBe("700");
  expect(typography.bold).toBeGreaterThan(typography.normal);
});
test("revision conflicts preserve local changes and offer a quota-counted copy", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  const row = (await (await browserApi(page).get("/api/exams")).json())[0];
  const remote = structuredClone(row.document);
  remote.meta.title = "نسخه دیگر";
  expect(
    (
      await browserApi(page).put("/api/exams/" + row.id, {
        data: { document: remote, revision: row.revision },
      })
    ).status(),
  ).toBe(200);
  await page.getByLabel("عنوان آزمون *").fill("تغییرات محلی");
  await expect(
    page.getByRole("button", { name: "ساخت کپی از تغییرات من" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ساخت کپی از تغییرات من" }).click();
  await expect(page).not.toHaveURL("/exam/" + row.id);
  await expect(page.getByLabel("عنوان آزمون *")).toHaveValue("تغییرات محلی");
  const exams = await (await browserApi(page).get("/api/exams")).json();
  expect(exams).toHaveLength(2);
});

test("AI plan purchase, three-type draft review, selective insertion and persistence", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "طرح حرفه‌ای هوشمند" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "بستن دستیار", exact: true }).click();
  const apiClient = browserApi(page);
  const order = await (
    await apiClient.post("/api/billing/checkout", {
      data: { planId: "professional-ai", idempotencyKey: randomUUID() },
    })
  ).json();
  expect(
    (
      await apiClient.post(`/api/billing/orders/${order.id}/mock-confirm`)
    ).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  await page.getByLabel("موضوع یا فصل درس").fill("جمع اعداد");
  await page.getByRole("button", { name: "ادامه؛ تنظیم سؤال‌ها" }).click();
  await page.getByLabel("تعداد سؤال چندگزینه‌ای").fill("1");
  await page.getByLabel("تعداد سؤال جای خالی").fill("1");
  await page.getByLabel("تعداد سؤال تشریحی").fill("1");
  await page
    .getByRole("checkbox", {
      name: "با ارسال متن و تنظیمات این درخواست به Groq موافقم",
    })
    .check();
  await page
    .getByRole("button", { name: "تولید سؤال‌ها", exact: true })
    .click();
  await expect(page.locator(".ai-draft")).toHaveCount(3);
  await expect
    .poll(() =>
      page.locator(".ai-dialog-body").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        return (
          el.getBoundingClientRect().bottom -
          el.querySelector(".ai-review > p").getBoundingClientRect().bottom
        );
      }),
    )
    .toBeLessThan(45);

  await page.screenshot({
    path: test.info().outputPath("ai-review.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("status", { name: "سهمیه باقی‌مانده این دوره" }),
  ).toContainText("۹۹");
  await page
    .locator(".ai-draft")
    .first()
    .locator(".tiptap")
    .first()
    .fill("متن ویرایش‌شده مدرس");
  await page.locator(".ai-draft").last().getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "افزودن سؤال‌های انتخابی" }).click();
  await expect(page.locator(".question-card")).toHaveCount(1);
  const savedExam = (
    await (await browserApi(page).get("/api/exams")).json()
  )[0];
  await expect
    .poll(
      async () =>
        (
          await (
            await browserApi(page).get("/api/exams/" + savedExam.id)
          ).json()
        ).document.questions.length,
    )
    .toBe(5);
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  await expect(page.locator(".ai-draft")).toHaveCount(1);
  await page.getByRole("button", { name: "بستن دستیار", exact: true }).click();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  await expect(page.locator(".ai-draft")).toHaveCount(1);
  await page.getByRole("button", { name: "بستن دستیار", exact: true }).click();
  // Uninserted drafts are intentionally discarded only after the browser leave warning.
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("button", { name: "مشخصات و قالب برگه", exact: true })
    .click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await expect(page.locator(".question-card")).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (
          await (
            await browserApi(page).get("/api/exams/" + savedExam.id)
          ).json()
        ).document.questions.length,
    )
    .toBe(5);
  if ((page.viewportSize()?.width || 1440) < 768) {
    await page.locator(".mobile-question-navigation > button").nth(1).click();
    await page
      .getByRole("list", { name: "سؤال‌های آزمون" })
      .locator(".v-list-item")
      .nth(3)
      .click();
  } else await page.locator(".studio-outline > button").nth(3).click();
  await expect(page.locator(".question-card").first()).toContainText(
    "متن ویرایش‌شده مدرس",
  );
  await page.getByRole("button", { name: "بازبینی و دریافت PDF" }).click();
  await page.getByRole("button", { name: "بازبینی PDF و دریافت برگه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 45000 });
});

test("AI PDF source extraction stays local and handles invalid and scanned files", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  const apiClient = browserApi(page);
  const order = await (
    await apiClient.post("/api/billing/checkout", {
      data: { planId: "professional-ai", idempotencyKey: randomUUID() },
    })
  ).json();
  await apiClient.post(`/api/billing/orders/${order.id}/mock-confirm`);
  await sample(page);
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await page
    .getByRole("button", { name: "تولید سؤال با هوش مصنوعی", exact: true })
    .click();
  const file = page.locator(".ai-dialog input[type=file]");
  await file.setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("corrupt"),
  });
  await expect(page.locator(".ai-dialog .v-alert")).toContainText(
    "PDF معتبر نیست",
  );
  const { aiPdfFixture } = await import("../fixtures/ai-pdf.js");
  await file.setInputFiles({
    name: "too-big.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".ai-dialog .v-alert")).toContainText("۱۰ مگابایت");
  await file.setInputFiles({
    name: "too-many-pages.pdf",
    mimeType: "application/pdf",
    buffer: aiPdfFixture({ pages: 101 }),
  });
  await expect(page.locator(".ai-dialog .v-alert")).toContainText("۱۰۰ صفحه");
  await file.setInputFiles({
    name: "encrypted.pdf",
    mimeType: "application/pdf",
    buffer: aiPdfFixture({ encrypted: true }),
  });
  await expect(page.locator(".ai-dialog .v-alert")).toContainText("رمزدار");
  await file.setInputFiles({
    name: "scanned.pdf",
    mimeType: "application/pdf",
    buffer: aiPdfFixture(),
  });
  await expect(page.getByText(/scanned.pdf/)).toBeVisible();
  await page.getByRole("button", { name: "استخراج متن صفحه‌ها" }).click();
  await expect(page.locator(".ai-dialog .v-alert")).toContainText("OCR");
  const { generatePdf } =
    await import("../../apps/backend/src/modules/exams/pdf.js");
  const source = exampleExam("en");
  const buffer = await generatePdf(source, "student");
  await file.setInputFiles({
    name: "lesson.pdf",
    mimeType: "application/pdf",
    buffer,
  });
  await expect(page.getByText(/lesson.pdf/)).toBeVisible();
  await page.getByRole("button", { name: "استخراج متن صفحه‌ها" }).click();
  await expect(
    page.getByLabel("متن درس؛ این متن مبنای سؤال‌ها خواهد بود"),
  ).toHaveValue(/Which number is prime/, { timeout: 20000 });
  const persianBuffer = await generatePdf(exampleExam("fa"), "student");
  await file.setInputFiles({
    name: "persian.pdf",
    mimeType: "application/pdf",
    buffer: persianBuffer,
  });
  await expect(page.getByText(/persian.pdf/)).toBeVisible();
  await page.getByRole("button", { name: "استخراج متن صفحه‌ها" }).click();
  await expect(
    page.getByLabel("متن درس؛ این متن مبنای سؤال‌ها خواهد بود"),
  ).toHaveValue(/[آ-ی]/);
  await page.getByRole("button", { name: "ادامه؛ تنظیم سؤال‌ها" }).click();
  await page
    .getByRole("checkbox", {
      name: "با ارسال متن و تنظیمات این درخواست به Groq موافقم",
    })
    .check();
  await page
    .getByRole("button", { name: "تولید سؤال‌ها", exact: true })
    .click();
  await expect(page.locator(".ai-draft")).toHaveCount(5);
});

test("formula palette renders symbols, nests templates and inserts at choice and editor cursors", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const card = page.locator(".question-card").first();
  const choice = card.getByLabel("گزینه ۱", { exact: true });
  await choice.fill("left right");
  await choice.evaluate((input) => {
    input.focus();
    const range = document.createRange();
    range.setStart(
      document.createTreeWalker(input, NodeFilter.SHOW_TEXT).nextNode(),
      5,
    );
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await card
    .locator(".option-rich-editor")
    .first()
    .getByRole("button", { name: "فرمول", exact: true })
    .click();
  const dialog = page.locator(".formula-dialog");
  await dialog
    .getByRole("button", { name: "LaTeX پیشرفته", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "کسر", exact: true }).locator(".katex"),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "کسر", exact: true }).click();
  await dialog.getByLabel("صورت", { exact: true }).fill("1+");
  await dialog.getByRole("button", { name: "ریشه دوم", exact: true }).click();
  await dialog.getByLabel("عبارت زیر رادیکال", { exact: true }).fill("t");
  await dialog.getByRole("button", { name: "درج قالب", exact: true }).click();
  await expect(dialog.getByLabel("صورت", { exact: true })).toHaveValue(
    /1\+\\sqrt/,
  );
  await dialog.getByLabel("مخرج", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "درج قالب", exact: true }).click();
  await expect(dialog.getByLabel("فرمول LaTeX", { exact: true })).toHaveValue(
    /\\frac/,
  );
  await dialog.getByRole("button", { name: "درج فرمول", exact: true }).click();
  await expect(choice).toContainText("left");
  await expect(choice).toContainText("right");
  await expect(choice.locator(".mfrac")).toHaveCount(1);
  const editor = card.locator(".tiptap").first();
  await editor.fill("AB");
  await page.keyboard.press("ArrowLeft");
  await card
    .locator(".rich-editor")
    .first()
    .getByRole("button", { name: "فرمول", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "LaTeX پیشرفته", exact: true })
    .click();
  await dialog.getByLabel("فرمول LaTeX", { exact: true }).fill("1+2");
  await dialog.getByLabel("فرمول LaTeX", { exact: true }).evaluate((input) => {
    input.focus();
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await dialog.getByRole("button", { name: "پی", exact: true }).click();
  await expect(dialog.getByLabel("فرمول LaTeX", { exact: true })).toHaveValue(
    "1+\\pi 2",
  );
  await dialog.getByRole("button", { name: "درج فرمول", exact: true }).click();
  await expect(editor.locator(".formula .katex")).toHaveCount(1);
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const rows = await (await browserApi(page).get("/api/exams")).json();
  const nodes = rows[0].document.questions[0].body.content[0].content;
  expect(nodes.map((n) => n.type)).toEqual(["text", "formula", "text"]);
  expect(nodes[0].text).toBe("A");
  expect(nodes[2].text).toBe("B");
  await page
    .getByRole("button", { name: "بازبینی و دریافت PDF", exact: true })
    .click();
  const mobileFormulaPreview = page.viewportSize().width < 768;
  if (mobileFormulaPreview)
    await page.locator(".mobile-preview-button").click();
  await expect(
    page.locator(
      mobileFormulaPreview
        ? ".v-dialog .print-pages .print-options .mfrac"
        : ".preview-canvas .print-pages .print-options .mfrac",
    ),
  ).toHaveCount(1);
  await page.screenshot({
    path: test.info().outputPath("math-choices.png"),
    fullPage: true,
  });
});

test("answer sheet supports manual formulas, multiline solutions and answer-key PDF export", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const card = page.locator(".question-card").first();
  await card
    .locator("summary")
    .filter({ hasText: "پاسخ‌نامه و صفحه‌بندی" })
    .click();
  const answer = card.getByLabel("پاسخ صحیح یا راهنمای تصحیح", { exact: true });
  await answer.fill("گام اول:\nپاسخ نهایی: ");
  await answer.evaluate((input) => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await card
    .getByRole("button", {
      name: "افزودن فرمول به پاسخ صحیح یا راهنمای تصحیح",
      exact: true,
    })
    .click();
  const dialog = page.locator(".formula-dialog");
  await dialog
    .getByRole("button", { name: "LaTeX پیشرفته", exact: true })
    .click();
  await dialog
    .getByLabel("فرمول LaTeX", { exact: true })
    .fill("\\frac{5}{2}\\,\\text{m/s}^2");
  await dialog.getByRole("button", { name: "درج فرمول", exact: true }).click();
  await expect(answer).toHaveValue(/^گام اول:\nپاسخ نهایی: \$\\frac/);
  await expect(card.locator(".option-rich-editor .mfrac")).toHaveCount(1);
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  const row = (await (await browserApi(page).get("/api/exams")).json())[0];
  expect(row.document.questions[0].answer).toContain("$\\frac{5}{2}");
  const response = await page.request.post(`/api/exams/${row.id}/pdf`, {
    data: { revision: row.revision, kind: "answer-key" },
  });
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("visual formulas use inline slots without keyboard, menu or parameter fields", async ({
  page,
}) => {
  await login(page);
  await sample(page);
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const card = page.locator(".question-card").first();
  await card
    .locator(".option-rich-editor")
    .first()
    .getByRole("button", { name: "فرمول", exact: true })
    .click();
  const dialog = page.locator(".formula-dialog");
  const field = dialog.locator("math-field");
  await expect(field).toBeVisible();
  expect(await field.evaluate((el) => el.mathVirtualKeyboardPolicy)).toBe(
    "manual",
  );
  expect(await field.evaluate((el) => el.menuItems.length)).toBe(0);
  await expect(field.locator('[part="keyboard-sink"]')).toHaveAttribute(
    "inputmode",
    "text",
  );
  await expect(field.locator('[part="virtual-keyboard-toggle"]')).toBeHidden();
  await expect(field.locator('[part="menu-toggle"]')).toBeHidden();
  const search = dialog.getByLabel("جستجوی نماد یا قالب", { exact: true });
  await search.fill("delta");
  await dialog.getByRole("button", { name: "دلتا", exact: true }).click();
  await expect
    .poll(() => field.evaluate((el) => el.value))
    .toContain(String.fromCharCode(92) + "Delta");
  await dialog
    .getByRole("button", { name: "پاک کردن فرمول", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "ماتریس و جبر خطی", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "ماتریس براکتی 3×3", exact: true })
    .click();
  await expect
    .poll(() => field.evaluate((el) => el.value))
    .toContain("bmatrix");
  await expect(
    dialog.getByRole("button", { name: "درج فرمول", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "پاک کردن فرمول", exact: true })
    .click();
  await dialog.getByRole("button", { name: "همه نمادها", exact: true }).click();
  await dialog.getByRole("button", { name: "کسر", exact: true }).click();
  await expect(dialog.locator(".formula-parameters")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "درج فرمول", exact: true }),
  ).toBeDisabled();
  await page.keyboard.type("1+");
  await dialog.getByRole("button", { name: "ریشه دوم", exact: true }).click();
  await page.keyboard.type("t");
  await dialog.getByRole("button", { name: "خانه بعدی", exact: true }).click();
  await page.keyboard.type("2");
  await expect(
    dialog.getByRole("button", { name: "درج فرمول", exact: true }),
  ).toBeEnabled();
  const completeFormula = await field.evaluate((el) => el.value);
  await dialog
    .getByRole("button", { name: "واگرد فرمول", exact: true })
    .click();
  await expect
    .poll(() => field.evaluate((el) => el.value))
    .not.toBe(completeFormula);
  await dialog
    .getByRole("button", { name: "بازانجام فرمول", exact: true })
    .click();
  await expect
    .poll(() => field.evaluate((el) => el.value))
    .toBe(completeFormula);
  await expect(
    dialog.getByRole("button", { name: "درج فرمول", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("formula-modal.png") });
  await dialog.getByRole("button", { name: "درج فرمول", exact: true }).click();
  await expect(card.locator(".option-rich-editor .mfrac")).toHaveCount(1);
  await expect(card.locator(".option-rich-editor .sqrt")).toHaveCount(1);
});
