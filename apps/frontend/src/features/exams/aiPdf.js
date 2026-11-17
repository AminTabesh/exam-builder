import { latin } from "@exam/shared/exam.js";
export function selectedPdfPages(value, total) {
  const pages = new Set();
  for (const part of latin(value).replace(/،/g, ",").split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("شماره صفحه‌ها را مانند ۱-۳،۵ وارد کنید.");
    const start = Number(match[1]),
      end = Number(match[2] || match[1]);
    if (start < 1 || end > total || end < start || end - start > 9)
      throw new Error("شماره صفحه نامعتبر است؛ حداکثر ۱۰ صفحه انتخاب کنید.");
    for (let i = start; i <= end; i++) pages.add(i);
  }
  if (!pages.size || pages.size > 10)
    throw new Error("از یک تا ده صفحه انتخاب کنید.");
  return [...pages].sort((a, b) => a - b);
}
export async function openTextPdf(file) {
  if (!file || file.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(file.name))
    throw new Error("یک فایل PDF تا حجم ۱۰ مگابایت انتخاب کنید.");
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } =
    await import("pdfjs-dist/build/pdf.worker.min.mjs?worker&url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(data.slice(0, 1024)).includes("%PDF-"))
    throw new Error("این فایل PDF معتبر نیست.");
  const task = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 100) {
      throw new Error(
        "فایل بیش از ۱۰۰ صفحه دارد؛ ابتدا بخش مورد نظر را جدا کنید.",
      );
    }
    return doc;
  } catch (error) {
    await task.destroy();
    if (error.name === "PasswordException")
      throw new Error(
        "PDF رمزدار پشتیبانی نمی‌شود؛ نسخه بدون رمز را انتخاب کنید.",
      );
    if (error.message?.includes("۱۰۰")) throw error;
    throw new Error(
      "فایل PDF خوانده نشد؛ یک فایل سالم با متن قابل انتخاب وارد کنید.",
    );
  }
}
export async function extractPdfPages(doc, selection) {
  const pages = selectedPdfPages(selection, doc.numPages),
    sections = [];
  for (const pageNumber of pages) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (item.str ? item.str + (item.hasEOL ? "\n" : " ") : ""))
      .join("")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
    page.cleanup();
    if (!text || text.replace(/\s/g, "").length < 10)
      throw new Error(
        `صفحه ${pageNumber} متن قابل استخراج ندارد. PDF اسکن‌شده به OCR نیاز دارد؛ متن را دستی بچسبانید یا صفحه دیگری انتخاب کنید.`,
      );
    sections.push(`[صفحه ${pageNumber}]\n${text}`);
  }
  return sections.join("\n\n");
}
