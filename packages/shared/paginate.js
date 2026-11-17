// Runs identically in the browser preview and Chromium export. Only safe block boundaries split.
export async function paginate(root, title, language) {
  const family = getComputedStyle(root).fontFamily;
  let loaded;
  try {
    loaded = await document.fonts.load(
      `12pt ${family}`,
      "آزمون Exam 0123456789",
    );
    await document.fonts.load(`700 12pt ${family}`, "0123456789");
  } catch {
    throw new Error("بارگذاری فونت آزمون کامل نشد. دوباره تلاش کنید.");
  }
  if (!loaded.length || !document.fonts.check(`12pt ${family}`, "آزمون Exam"))
    throw new Error("بارگذاری فونت آزمون کامل نشد. دوباره تلاش کنید.");
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
  const formal = (root.dataset.style || "formal") === "formal";
  pages.replaceChildren();
  const en = language === "en",
    num = (v) => {
      const latin = String(v)
        .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
        .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
      return en ? latin : latin.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
    };
  const localizeNumbers = (element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      // Formula markup has its own shaping and mathematical font encoding.
      if (!text.parentElement?.closest("style, script, .katex, math"))
        text.nodeValue = num(text.nodeValue);
    }
  };
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
    page.className = `exam-page style-${root.dataset.style || "formal"}`;
    body = document.createElement("div");
    body.className = "page-body";
    footer = document.createElement("footer");
    footer.className = "page-footer";
    if (pages.children.length) {
      const header = document.createElement("div");
      header.className = "continuation-header";
      header.textContent =
        num(title) + " — " + (en ? "continued" : "ادامه آزمون");
      body.append(header);
      if (formal) body.append(tableHeading());
    }
    page.append(body, footer);
    pages.append(page);
  };
  const fits = () => body.scrollHeight <= body.clientHeight + 1;
  fresh();
  for (const original of source.children) {
    if (original.dataset.break === "true" && pageHasContent()) fresh();
    const node = original.cloneNode(true);
    localizeNumbers(node);
    body.append(node);
    if (fits()) {
      if (formal && node.matches(".exam-header")) body.append(tableHeading());
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
  // Geometry is calculated after cloning/pagination in both browser preview and PDF export.
  // Ratios keep connection endpoints correct when a browser preview is scaled.
  for (const board of pages.querySelectorAll(
    ".matching-print-board[data-matching-pairs]",
  )) {
    const svg = board.querySelector(".matching-connections");
    if (!svg) continue;
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 1000 1000");
    const bounds = board.getBoundingClientRect();
    if (!bounds.width || !bounds.height) continue;
    const dots = new Map(
      [...board.querySelectorAll("[data-matching-id]")].map((item) => [
        item.dataset.matchingId,
        item.querySelector(".matching-dot"),
      ]),
    );
    for (const pair of JSON.parse(board.dataset.matchingPairs)) {
      const from = dots.get(pair.leftId)?.getBoundingClientRect(),
        to = dots.get(pair.rightId)?.getBoundingClientRect();
      if (!from || !to) continue;
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute(
        "x1",
        String(
          (1000 * (from.left + from.width / 2 - bounds.left)) / bounds.width,
        ),
      );
      line.setAttribute(
        "y1",
        String(
          (1000 * (from.top + from.height / 2 - bounds.top)) / bounds.height,
        ),
      );
      line.setAttribute(
        "x2",
        String((1000 * (to.left + to.width / 2 - bounds.left)) / bounds.width),
      );
      line.setAttribute(
        "y2",
        String((1000 * (to.top + to.height / 2 - bounds.top)) / bounds.height),
      );
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      svg.append(line);
    }
  }
  return all.length;
}
