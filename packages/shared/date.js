import moment from "moment-jalaali";
import { latin } from "./exam.js";
export const dateFormat = (calendar) =>
  calendar === "jalali" ? "jYYYY/jMM/jDD" : "YYYY/MM/DD";
export function parseDate(value, calendar) {
  const text = latin(value);
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return null;
  const date = moment(text, dateFormat(calendar), "en", true);
  return date.isValid() &&
    date.locale("en").format(dateFormat(calendar)) === text
    ? date
    : null;
}
export function convertDate(value, from, to) {
  return parseDate(value, from)?.format(dateFormat(to)) ?? value;
}
