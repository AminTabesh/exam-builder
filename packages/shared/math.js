import katex from "katex";

export const mathOptions = {
  throwOnError: true,
  trust: false,
  strict: (code, message) =>
    ["unknownSymbol", "unicodeTextInMathMode"].includes(code) &&
    /[\u0600-\u06ff]/u.test(message)
      ? "ignore"
      : "error",
  maxExpand: 1000,
};
export function renderFormula(latex) {
  return katex.renderToString(latex, mathOptions);
}

// Keep persisted choice/answer strings backward compatible; delimiters mark math spans.
export function mathSegments(value = "") {
  const text = String(value),
    segments = [];
  const pattern =
    /\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end)
      segments.push({ text: text.slice(end, match.index) });
    segments.push({
      latex: cleanLatex(
        match
          .slice(1)
          .find((v) => v !== undefined)
          .trim(),
      ),
    });
    end = match.index + match[0].length;
  }
  if (end < text.length) segments.push({ text: text.slice(end) });
  return segments;
}
export function mathErrors(value) {
  const errors = [];
  for (const part of mathSegments(value))
    if (part.latex !== undefined) {
      try {
        if (!part.latex || part.latex.length > 2000) throw new Error();
        renderFormula(part.latex);
      } catch {
        errors.push("فرمول معتبر نیست؛ ساختار و آکولادها را بررسی کنید.");
      }
    }
  return errors;
}
export const cleanLatex = (value) =>
  String(value)
    .replace(/\u0009ext\b/g, "\\text")
    .replace(/\u000crac\b/g, "\\frac")
    .replace(/\u0008egin\b/g, "\\begin")
    .replace(/\u000dight\b/g, "\\right");
const aiLatex = (value) =>
  cleanLatex(value).replace(
    /(?<!\\)\b(dfrac|tfrac|frac|sqrt|text|mathrm|vec|hat|overrightarrow)(?=\s*(?:\{|\[))/g,
    "\\$1",
  );
export function normalizeAiMath(value, wrapBare = true) {
  let text = cleanLatex(value);
  if (
    wrapBare &&
    !mathSegments(text).some((p) => p.latex !== undefined) &&
    /\\?(?:dfrac|tfrac|frac|sqrt|text|vec|hat|mathrm|overrightarrow)\s*(?:\{|\[)/.test(
      text,
    )
  )
    text = `$${aiLatex(text)}$`;
  return mathSegments(text)
    .map((part) =>
      part.latex === undefined ? part.text : `$${aiLatex(part.latex)}$`,
    )
    .join("");
}
