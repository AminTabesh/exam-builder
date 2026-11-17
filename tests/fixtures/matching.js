import { newQuestion, paragraph, uid } from "@exam/shared/exam.js";
export function matchingQuestion() {
  const q = newQuestion("matching");
  q.body = paragraph("موارد مرتبط را به یکدیگر وصل کنید.");
  q.matching.left[0].body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "دو برابر " },
          { type: "formula", attrs: { latex: "2" } },
        ],
      },
    ],
  };
  q.matching.left[1].body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "سه برابر " },
          { type: "blank", attrs: { width: 40 } },
        ],
      },
    ],
  };
  q.matching.right[0].body = paragraph("شش");
  q.matching.right[1].body = paragraph("چهار");
  q.matching.right.push({ id: uid(), body: paragraph("پاسخ اضافی") });
  q.matching.pairs = [
    { leftId: q.matching.left[0].id, rightId: q.matching.right[1].id },
    { leftId: q.matching.left[1].id, rightId: q.matching.right[0].id },
  ];
  return q;
}
