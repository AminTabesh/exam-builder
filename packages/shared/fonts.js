import { resourceUrl } from "./resources.js";
export const defaultFont = "b-nazanin";
export const bundledFonts = [
  { id: "b-nazanin", name: "بی نازنین", family: "B Nazanin" },
  { id: "vazirmatn", name: "وزیرمتن", family: "Vazirmatn" },
  { id: "noto-naskh", name: "نسخ عربی", family: "Noto Naskh Arabic" },
  { id: "noto-sans", name: "نوتو سنس عربی", family: "Noto Sans Arabic" },
];
export function fontFamily(id = defaultFont) {
  return (
    bundledFonts.find((font) => font.id === id)?.family ||
    (/^[a-f0-9-]{36}$/.test(id) ? `ExamFont-${id}` : "B Nazanin")
  );
}
export function customFontCss(id) {
  if (!/^[a-f0-9-]{36}$/.test(id || "")) return "";
  return `@font-face{font-family:"ExamFont-${id}";src:url("${resourceUrl(`/api/fonts/${id}/file`)}");font-weight:400;font-style:normal;font-display:block;}`;
}
