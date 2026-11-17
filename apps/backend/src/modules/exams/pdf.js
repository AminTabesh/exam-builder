import { ROOT } from "../../config/env.js";
import { chromium } from "playwright";
import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PrintDocument from "@exam/shared/PrintDocument.js";
import { paginate } from "@exam/shared/paginate.js";
let active = 0;
export async function generatePdf(
  exam,
  kind,
  assetFiles = new Map(),
  { maxPages = Infinity } = {},
) {
  if (active >= 2)
    throw Object.assign(
      new Error("سرویس دریافت PDF مشغول است. کمی بعد دوباره تلاش کنید."),
      { status: 429 },
    );
  active++;
  let browser;
  const start = Date.now();
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true,
      args: process.env.CHROMIUM_NO_SANDBOX === "true" ? ["--no-sandbox"] : [],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.route("**/*", async (route) => {
      try {
        const url = new URL(route.request().url());
        if (url.origin !== "http://print.local") return route.abort();
        let file, type;
        if (url.pathname.startsWith("/fonts/")) {
          file = path.join(
            ROOT,
            "apps/frontend/public/fonts",
            path.basename(url.pathname),
          );
          type = file.endsWith(".ttf") ? "font/ttf" : "font/woff2";
        } else if (url.pathname.startsWith("/katex/")) {
          file = path.join(
            ROOT,
            "node_modules/katex/dist/fonts",
            path.basename(url.pathname),
          );
          type = "font/woff2";
        } else if (assetFiles.has(url.pathname)) {
          file = assetFiles.get(url.pathname);
          type = file.endsWith(".otf")
            ? "font/otf"
            : file.endsWith(".ttf")
              ? "font/ttf"
              : "image/webp";
        } else return route.abort();
        await route.fulfill({ body: await readFile(file), contentType: type });
      } catch {
        await route.abort();
      }
    });
    const html = await renderToString(
      createSSRApp({ render: () => h(PrintDocument, { exam, kind }) }),
    );
    const css = await readFile(
      path.join(ROOT, "packages/shared/print.css"),
      "utf8",
    );
    const katex = (
      await readFile(
        path.join(ROOT, "node_modules/katex/dist/katex.min.css"),
        "utf8",
      )
    ).replaceAll("fonts/", "/katex/");
    await page.setContent(
      `<!doctype html><html><head><base href="http://print.local/"><meta charset="utf-8"><style>${css}\n${katex}</style></head><body>${html}</body></html>`,
      { waitUntil: "networkidle" },
    );
    const pagination = await page.evaluate(
      async ({ fn, title, language }) => {
        const paginate = (0, eval)("(" + fn + ")");
        try {
          return {
            pages: await paginate(
              document.querySelector(".print-document"),
              title,
              language,
            ),
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      {
        fn: paginate.toString(),
        title: exam.meta.title,
        language: exam.layout.language,
      },
    );
    if (pagination.error)
      throw Object.assign(new Error(pagination.error), { status: 422 });
    const pages = pagination.pages;
    if (pages > maxPages)
      throw Object.assign(
        new Error(
          `این خروجی ${pages} صفحه دارد؛ سقف طرح شما ${maxPages} صفحه است. طرح را ارتقا دهید یا آزمون را کوتاه کنید.`,
        ),
        { status: 402, code: "PAGE_LIMIT" },
      );
    const result = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30000,
    });
    console.info(
      JSON.stringify({
        event: "pdf_complete",
        durationMs: Date.now() - start,
        pages,
        kind,
      }),
    );
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "pdf_error",
        durationMs: Date.now() - start,
        code: error.name,
      }),
    );
    throw error;
  } finally {
    await browser?.close();
    active--;
  }
}
