// Runs identically in the browser preview and Chromium export. Only safe block boundaries split.
export async function paginate(root, title, language) {
  await document.fonts.ready;
  await Promise.all(
    [...root.querySelectorAll("img")].map((img) =>
      img.decode().catch(() => {
        throw new Error("بارگذاری تصویر کامل نشد. دوباره تلاش کنید.");
      }),
    ),
  );
  const source = root.querySelector(".print-source"),
    pages = root.querySelector(".print-pages");
  pages.replaceChildren();
  const en = language === "en",
    num = (v) =>
      en ? String(v) : String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  let page, body, footer;
  const tableHeading = () => {
    const heading = document.createElement("div");
    heading.className = "table-heading";
    for (const text of en
      ? ["No.", "Question / Response", "Marks"]
      : ["ردیف", "سؤال / پاسخ", "بارم"]) {
      const cell = document.createElement("span");
      cell.textContent = text;
      heading.append(cell);
    }
    return heading;
  };
  const pageHasContent = () =>
    [...body.children].some(
      (el) => !el.matches(".continuation-header, .table-heading"),
    );
  const fresh = () => {
    page = document.createElement("section");
    page.className = "exam-page";
    body = document.createElement("div");
    body.className = "page-body";
    footer = document.createElement("footer");
    footer.className = "page-footer";
    if (pages.children.length) {
      const header = document.createElement("div");
      header.className = "continuation-header";
      header.textContent = title + " — " + (en ? "continued" : "ادامه آزمون");
      body.append(header, tableHeading());
    }
    page.append(body, footer);
    pages.append(page);
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  fresh();
  for (const original of source.children) {
    if (original.dataset.break === "true" && pageHasContent()) fresh();
    const node = original.cloneNode(true);
    body.append(node);
    if (fits()) {
      if (node.matches(".exam-header")) body.append(tableHeading());
      continue;
    }
    node.remove();
    if (pageHasContent()) {
      fresh();
      body.append(node);
      if (fits()) continue;
      node.remove();
    }
    if (!node.classList.contains("print-question"))
      throw new Error(
        "این بخش در یک صفحه جا نمی‌شود. متن را کوتاه‌تر یا تصویر را کوچک‌تر کنید.",
      );
    const parts = [...node.children];
    let fragment = node.cloneNode(false);
    body.append(fragment);
    let hasContent = false;
    for (const part of parts) {
      fragment.append(part);
      if (fits()) {
        if (!part.matches(".question-top")) hasContent = true;
        continue;
      }
      part.remove();
      if (!hasContent)
        throw new Error(
          "یک بخش سؤال بزرگ‌تر از صفحه است. تصویر را کوچک‌تر یا متن را به چند بند تقسیم کنید.",
        );
      fresh();
      fragment = node.cloneNode(false);
      const label = document.createElement("div");
      label.className = "question-top";
      const number = document.createElement("b");
      number.textContent =
        node.querySelector(".question-top b")?.textContent || "";
      const continued = document.createElement("small");
      continued.textContent = en ? "Question continued" : "ادامه سؤال";
      label.append(number, document.createElement("span"), continued);
      fragment.append(label, part);
      body.append(fragment);
      if (!fits())
        throw new Error(
          "یک بخش سؤال در صفحه جا نمی‌شود. اندازه تصویر یا طول بند را کاهش دهید.",
        );
      hasContent = true;
    }
  }
  const all = [...pages.children];
  all.forEach((p, i) => {
    p.querySelector(".page-footer").textContent = en
      ? `Page ${i + 1} of ${all.length}`
      : `صفحه ${num(i + 1)} از ${num(all.length)}`;
  });
  pages.querySelectorAll(".page-count").forEach((el) => {
    el.textContent = (en ? "Pages: " : "تعداد صفحات: ") + num(all.length);
  });
  // Reject horizontal overflow as well as tall blocks (for example a wide formula).
  for (const body of pages.querySelectorAll(".page-body")) {
    if (
      body.scrollWidth > body.clientWidth + 1 ||
      body.scrollHeight > body.clientHeight + 1
    )
      throw new Error(
        "محتوا از محدوده چاپ بیرون زده است. فرمول یا تصویر را کوچک‌تر کنید.",
      );
  }
  return all.length;
}
