export const plans = [
  {
    id: "free",
    name: "رایگان",
    price: 0,
    currency: "IRR",
    exams: 3,
    pages: 2,
    aiGenerations: 0,
  },
  {
    id: "standard",
    name: "استاندارد",
    price: 1490000,
    currency: "IRR",
    exams: 30,
    pages: 10,
    aiGenerations: 0,
  },
  {
    id: "professional",
    name: "حرفه‌ای",
    price: 2990000,
    currency: "IRR",
    exams: null,
    pages: 30,
    aiGenerations: 0,
  },
  {
    id: "professional-ai",
    name: "حرفه‌ای هوشمند",
    price: 4990000,
    currency: "IRR",
    exams: null,
    pages: 30,
    aiGenerations: 100,
  },
];
export function addMonth(anchor, offset = 1) {
  const date = new Date(anchor),
    day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}
