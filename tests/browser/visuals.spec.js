import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function login(page) {
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
  await teacherName.fill("سارا احمدی");
  await page
    .getByRole("button", { name: "ذخیره و ادامه", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:5183/dashboard");
}

test("parabola live editing, resizing, wrapping, undo and persistence", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const editor = page.locator(".rich-editor").first();
  await editor.locator(".tiptap").click();
  await editor.getByRole("button", { name: "سهمی", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ضریب a", { exact: true }).fill("۰");
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByLabel("ضریب a", { exact: true }).fill("۱");
  await dialog.getByLabel("ضریب b", { exact: true }).fill("-۲");
  await dialog.getByLabel("ضریب c", { exact: true }).fill("۱");
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  const visual = editor.locator("[data-visual=parabola]");
  await expect(visual).toHaveCount(1);
  await visual.click({ position: { x: 30, y: 40 } });
  await visual
    .getByRole("button", { name: "کنار متن راست", exact: true })
    .click();
  await expect(visual).toHaveCSS("float", "right");
  await visual.getByLabel("عرض شکل").fill("220");
  await visual.getByLabel("عرض شکل").press("Tab");
  await expect(visual).toHaveCSS("width", "220px");
  if (test.info().project.name !== "mobile") {
    const handle = visual.locator(".visual-se");
    const r = await handle.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + 50, r.y, { steps: 6 });
    await page.mouse.up();
    await expect(visual).not.toHaveCSS("width", "220px");
  }
  await visual.getByRole("button", { name: "ویرایش", exact: true }).click();
  await expect(dialog.getByLabel("ضریب b", { exact: true })).toHaveValue(
    /-[2۲]/,
  );
  await dialog.getByLabel("ضریب b", { exact: true }).fill("4");
  await dialog.getByRole("button", { name: "انصراف", exact: true }).click();
  await visual.getByRole("button", { name: "ویرایش", exact: true }).click();
  await expect(dialog.getByLabel("ضریب b", { exact: true })).toHaveValue(
    /-[2۲]/,
  );
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await expect(page.locator("[data-visual=parabola]")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("visual handles move diagrams and images and vertex dragging changes coefficients", async ({
  page,
}, info) => {
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const editor = page.locator(".rich-editor").first();
  await editor.getByRole("button", { name: "سهمی", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (info.project.name !== "mobile") {
    await dialog.locator("[data-vertex]").hover();
    const v = await dialog.locator("[data-vertex]").boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    await page.mouse.down();
    await page.mouse.move(v.x + 30, v.y - 20, { steps: 8 });
    await page.mouse.up();
    await expect(dialog.getByLabel("ضریب b", { exact: true })).not.toHaveValue(
      /^[0۰]$/,
    );
  }
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  await editor.getByRole("button", { name: "شکل", exact: true }).click();
  await dialog
    .getByRole("button", { name: "نمودار نیرو", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "درج / ذخیره شکل", exact: true })
    .click();
  const drawing = editor.locator("[data-visual=drawing]");
  await drawing.click({ position: { x: 20, y: 30 } });
  await drawing.getByLabel("عرض شکل").fill("180");
  await drawing.getByLabel("عرض شکل").press("Tab");
  await expect(drawing).toHaveCSS("width", "180px");
  await drawing
    .getByRole("button", { name: "کنار متن چپ", exact: true })
    .click();
  await expect(drawing).toHaveCSS("float", "left");
  await editor
    .getByRole("button", { name: "ابزارهای بیشتر", exact: true })
    .click();
  await editor.locator("input[type=file]").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const image = editor.locator("[data-visual=image]");
  await expect(image).toHaveCount(1);
  await image.click({ position: { x: 20, y: 20 } });
  await image.getByLabel("عرض شکل").fill("100");
  await image.getByLabel("عرض شکل").press("Tab");
  await expect(image).toHaveCSS("width", "100px");
  if (info.project.name !== "mobile") {
    await image.getByRole("button", { name: "در متن", exact: true }).click();
    const drag = image.getByRole("button", { name: "جابجایی", exact: true });
    await drag.scrollIntoViewIfNeeded();
    const start = await drag.boundingBox();
    const target = await editor.locator(".tiptap").boundingBox();
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(target.x + target.width * 0.15, target.y + 15, {
      steps: 10,
    });
    await expect(page.locator(".visual-drop-guide")).toBeVisible();
    await page.mouse.up();
    await expect(image).toHaveCSS("float", "left");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(image).toHaveCSS("float", "none");
  }
  await page.screenshot({
    path: info.outputPath("visual-controls.png"),
    fullPage: true,
  });
});

test("polished graph supports Persian numbers, custom points, click placement and themed sliders", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const editor = page.locator(".rich-editor").first();
  await expect(
    editor.getByRole("button", { name: "سهمی", exact: true }).locator("svg"),
  ).toHaveCount(1);
  await editor.getByRole("button", { name: "سهمی", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("ضریب a", { exact: true })).toHaveValue("۱");
  await dialog.getByRole("button", { name: "123 لاتین", exact: true }).click();
  await expect(dialog.getByLabel("ضریب a", { exact: true })).toHaveValue("1");
  await dialog.getByLabel("ضریب a", { exact: true }).fill("1.23456789");
  await dialog.getByRole("button", { name: "۱۲۳ فارسی", exact: true }).click();
  await expect(dialog.getByLabel("ضریب a", { exact: true })).toHaveValue(
    "۱٫۲۳۴۵۶۷۸۹",
  );
  await dialog.getByRole("button", { name: "123 لاتین", exact: true }).click();
  await expect(dialog.getByLabel("ضریب a", { exact: true })).toHaveValue(
    "1.23456789",
  );
  await dialog.getByLabel("ضریب a", { exact: true }).fill("1");

  await dialog.getByRole("button", { name: "۱۲۳ فارسی", exact: true }).click();
  await dialog.getByLabel("نام نقطه جدید").fill("P");
  await dialog.getByLabel("مختصات x نقطه جدید").fill("۱٫۵");
  await dialog.getByLabel("مختصات y نقطه جدید").fill("۲");
  await dialog
    .getByRole("button", { name: "افزودن نقطه", exact: true })
    .click();
  await expect(dialog.locator("[data-point]")).toHaveCount(1);
  await expect(
    dialog.locator("svg").getByText("P (۱٫۵, ۲)", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "افزودن با کلیک", exact: true })
    .click();
  await dialog
    .locator(".parabola-preview")
    .click({ position: { x: 90, y: 100 } });
  await expect(dialog.locator("[data-point]")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "افزودن با کلیک", exact: true })
    .click();
  if (info.project.name !== "mobile") {
    const point = dialog.locator('[data-point="0"]');
    await point.hover();
    const r = await point.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + 25, r.y + 15, { steps: 5 });
    await page.mouse.up();
    await expect(
      dialog.getByLabel("مختصات x نقطه 1", { exact: true }),
    ).not.toHaveValue("۱٫۵");
  }
  const slider = dialog.getByRole("slider", {
    name: "ضریب بازشدگی",
    exact: true,
  });
  await expect(slider).toHaveAttribute("aria-valuetext", /۱/);
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("1.05");
  await dialog
    .locator("summary")
    .filter({ hasText: "رنگ و تنظیمات نما" })
    .click();
  await dialog.getByRole("button", { name: "قرمز", exact: true }).click();
  await dialog.getByLabel("ضخامت خط", { exact: true }).focus();
  await dialog.getByLabel("ضخامت خط", { exact: true }).press("ArrowRight");
  await page.screenshot({
    path: info.outputPath("polished-parabola.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  const visual = editor.locator("[data-visual=parabola]");
  await expect(visual.locator("[data-point]")).toHaveCount(2);
  await visual.click({ position: { x: 20, y: 30 } });
  await visual.getByRole("button", { name: "ویرایش", exact: true }).click();
  await expect(dialog.getByLabel("نام نقطه 1", { exact: true })).toHaveValue(
    "P",
  );
  await expect(
    dialog.getByRole("button", { name: "۱۲۳ فارسی", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "حذف نقطه 2", exact: true }).click();
  await expect(dialog.locator("[data-point]")).toHaveCount(1);
  await dialog.getByRole("button", { name: "ذخیره سهمی" }).click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await expect(page.locator("[data-visual=parabola] [data-point]")).toHaveCount(
    1,
  );
  expect(errors).toEqual([]);
});

test("linear graph controls and individual point styling persist", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  const editor = page.locator(".rich-editor").first();
  await editor.getByRole("button", { name: "سهمی", exact: true }).click();
  const dialog = page.locator(".parabola-dialog");
  await dialog
    .getByRole("button", { name: "معادله درجه یک", exact: true })
    .click();
  await dialog.getByRole("button", { name: "y = 2x − 2", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "معادله درجه یک", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByLabel("ضریب b", { exact: true }).fill("۲");
  await dialog.getByLabel("ضریب c", { exact: true }).fill("-۲");
  await expect(dialog.locator("svg [data-marker=vertex]")).toHaveCount(0);
  await dialog.getByLabel("نام نقطه جدید").fill("A");
  await dialog.getByLabel("مختصات x نقطه جدید").fill("۱");
  await dialog.getByLabel("مختصات y نقطه جدید").fill("۲");
  await dialog
    .getByRole("button", { name: "افزودن نقطه", exact: true })
    .click();
  await dialog.getByLabel("رنگ نقطه 1", { exact: true }).fill("#ff8800");
  await dialog.getByLabel("نمایش اطلاعات نقطه 1", { exact: true }).uncheck();
  await dialog.getByLabel("نقطه‌های ریشه", { exact: true }).uncheck();
  await dialog.getByLabel("معادله", { exact: true }).uncheck();
  await expect(dialog.locator("svg [data-marker=root]")).toHaveCount(0);
  await expect(dialog.locator("svg [data-marker=custom]")).toHaveAttribute(
    "fill",
    "#ff8800",
  );
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await dialog.locator(".graph-header").scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("graph-modal.png") });
  await page.getByRole("button", { name: "ذخیره نمودار" }).click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "سؤال‌ها و ویرایش" }).click();
  await expect(
    page
      .locator('.rich-editor svg[aria-label="نمودار معادله درجه یک"]')
      .first(),
  ).toBeVisible();
  await expect(
    page.locator(".rich-editor [data-marker=custom]").first(),
  ).toHaveAttribute("fill", "#ff8800");
});

test("drawing items resize from box corners, undo, cancel and persist", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await page
    .locator(".rich-editor")
    .first()
    .getByRole("button", { name: "شکل", exact: true })
    .click();
  const editor = page.locator(".drawing-editor");
  await editor.getByRole("button", { name: "مستطیل", exact: true }).click();
  await editor.getByRole("checkbox", { name: "چسبیدن به شبکه" }).uncheck();
  await editor.getByLabel("چرخش (درجه)", { exact: true }).fill("30");
  const width = editor.getByLabel("عرض", { exact: true });
  const height = editor.getByLabel("ارتفاع", { exact: true });
  const touch =
    test.info().project.name === "mobile"
      ? await page.context().newCDPSession(page)
      : null;
  async function resize(corner, dx, dy, cancel = false) {
    const handle = editor.locator(`[data-resize-corner="${corner}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    if (touch) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 6; step++)
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * step) / 6, y: y + (dy * step) / 6 }],
        });
      if (cancel) await page.keyboard.press("Escape");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 6 });
      if (cancel) await page.keyboard.press("Escape");
      await page.mouse.up();
    }
  }
  await resize("se", 35, 35);
  expect(Number(await width.inputValue())).toBeGreaterThan(100);
  const resizedWidth = await width.inputValue(),
    resizedHeight = await height.inputValue();
  await editor.getByRole("button", { name: "واگرد", exact: true }).click();
  await expect(width).toHaveValue("100");
  await expect(height).toHaveValue("80");
  await editor.getByRole("button", { name: "بازانجام", exact: true }).click();
  await expect(width).toHaveValue(resizedWidth);
  await resize("nw", -20, -20, true);
  await expect(width).toHaveValue(resizedWidth);
  await expect(height).toHaveValue(resizedHeight);
  await editor.getByRole("button", { name: "درج / ذخیره شکل" }).click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  const visual = page.locator("[data-visual=drawing]").first();
  await visual.dblclick({ position: { x: 30, y: 40 } });
  const canvas = editor.locator(".drawing-canvas");
  await canvas.locator("g[role=button]").first().click();
  await expect(width).toHaveValue(resizedWidth);
  await expect(height).toHaveValue(resizedHeight);
});

test("multiple choice options support graphs and shapes, save/reopen and print preview", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "شروع با آزمون نمونه" }).click();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  const options = page.locator(".options-editor .option-rich-editor");
  await expect(options).toHaveCount(4);
  await options
    .nth(0)
    .getByRole("button", { name: "سهمی", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ذخیره سهمی", exact: true })
    .click();
  await options
    .nth(1)
    .getByRole("button", { name: "شکل", exact: true })
    .click();
  const drawing = page.locator(".drawing-editor");
  await drawing.getByRole("button", { name: "مستطیل", exact: true }).click();
  await drawing
    .getByRole("button", { name: "درج / ذخیره شکل", exact: true })
    .click();
  await expect(
    page.getByText("همه تغییرات ذخیره شد", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "سؤال‌ها و ویرایش", exact: true })
    .click();
  await expect(options.nth(0).locator("[data-visual=parabola]")).toHaveCount(1);
  await expect(options.nth(1).locator("[data-visual=drawing]")).toHaveCount(1);
  if ((page.viewportSize()?.width || 1440) < 768)
    await page.getByRole("button", { name: "پیش‌نمایش", exact: true }).click();
  await expect(
    page.locator(".print-pages .print-options .exam-drawing"),
  ).toHaveCount(2);
});
