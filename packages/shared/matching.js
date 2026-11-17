import { digits } from "./exam.js";
export function matchingLabel(side, index, language = "fa") {
  if (side === "left") return digits(index + 1, language);
  return language === "en"
    ? String.fromCharCode(65 + index)
    : ["الف", "ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "د", "ذ", "ر"][index];
}
