import { h } from "vue";
import katex from "katex";
import { digits, total, count } from "./exam.js";
export function rich(node) {
  if (!node) return null;
  if (node.type === "text") {
    let result = node.text;
    for (const m of node.marks || [])
      result = h(
        {
          bold: "strong",
          italic: "em",
          strike: "s",
          code: "code",
          underline: "u",
        }[m.type] || "span",
        {},
        result,
      );
    return result;
  }
  if (node.type === "formula") {
    let html;
    try {
      html = katex.renderToString(node.attrs?.latex || "", {
        throwOnError: true,
        trust: false,
        strict: "error",
        maxExpand: 1000,
      });
    } catch {
      html = "[invalid formula]";
    }
    return h("span", { class: "formula", dir: "ltr", innerHTML: html });
  }
  if (node.type === "blank")
    return h(
      "span",
      {
        class: "inline-blank",
        style: { width: `${node.attrs?.width || 90}px` },
      },
      "\u00a0",
    );
  if (node.type === "image")
    return h("img", {
      src: node.attrs?.src,
      alt: node.attrs?.alt || "",
      style: { width: `${node.attrs?.width || 240}px` },
    });
  const tags = {
    doc: "div",
    paragraph: "p",
    heading: "h3",
    bulletList: "ul",
    orderedList: "ol",
    listItem: "li",
    blockquote: "blockquote",
    hardBreak: "br",
    horizontalRule: "hr",
  };
  return h(
    tags[node.type] || "span",
    {
      dir:
        node.attrs?.dir ||
        (["paragraph", "heading", "blockquote"].includes(node.type)
          ? "auto"
          : undefined),
      start: node.type === "orderedList" ? node.attrs?.start : undefined,
      type: node.type === "orderedList" ? node.attrs?.type : undefined,
    },
    (node.content || []).map(rich),
  );
}
export default {
  props: ["exam", "kind"],
  setup(props) {
    return () => {
      const e = props.exam,
        en = e.layout.language === "en",
        n = (v) => digits(v, e.layout.language),
        t = (fa, eng) => (en ? eng : fa);
      let index = 0;
      const field = (label, value) =>
        value ? h("span", [h("b", label + ": "), value]) : null;
      return h(
        "div",
        {
          class: "print-document",
          dir: en ? "ltr" : "rtl",
          style: { "--exam-font": e.layout.fontSize + "pt" },
        },
        [
          h("div", { class: "print-source" }, [
            h("header", { class: "exam-header" }, [
              e.meta.opening && h("div", { class: "opening" }, e.meta.opening),
              h("div", { class: "header-title" }, [
                e.meta.logo &&
                  h("img", { class: "exam-logo", src: e.meta.logo }),
                h("div", [
                  h("p", e.meta.institution),
                  h("h1", e.meta.title),
                  props.kind === "answer-key" &&
                    h(
                      "strong",
                      { class: "answer-label" },
                      t("پاسخ‌نامه ویژه مدرس", "TEACHER ANSWER KEY"),
                    ),
                ]),
              ]),
              h("div", { class: "header-grid" }, [
                field(t("درس", "Course"), e.meta.course),
                field(t("مدرس", "Instructor"), e.meta.instructor),
                field(t("تاریخ", "Date"), e.meta.date),
                field(
                  t("مدت", "Duration"),
                  e.meta.duration
                    ? n(e.meta.duration) + " " + t("دقیقه", "minutes")
                    : "",
                ),
                field(t("شروع", "Start"), e.meta.startTime),
                field(t("سال تحصیلی", "Academic year"), e.meta.year),
                ...(e.layout.template === "school"
                  ? [
                      field(t("پایه", "Grade"), e.meta.grade),
                      field(t("رشته", "Field"), e.meta.field),
                    ]
                  : [
                      field(t("دانشکده", "Faculty"), e.meta.faculty),
                      field(t("گروه", "Department"), e.meta.department),
                      field(t("کد درس", "Course code"), e.meta.courseCode),
                      field(t("نیمسال", "Semester"), e.meta.semester),
                    ]),
                field(t("تعداد سؤال", "Questions"), n(count(e))),
                field(t("نمره کل", "Total marks"), n(total(e) / 100)),
                h(
                  "span",
                  { class: "page-count" },
                  t("تعداد صفحات: ۰۰۰", "Pages: 000"),
                ),
              ]),
              h("div", { class: "student-fields" }, [
                h(
                  "span",
                  t("نام و نام خانوادگی: ………………………", "Full name: ………………………"),
                ),
                h(
                  "span",
                  t("کد دانش‌آموز / دانشجو: ……………", "Student code: ……………"),
                ),
                h("span", t("کلاس / گروه: ……………", "Class / group: ……………")),
                e.meta.awardedScore &&
                  h("span", t("نمره کسب‌شده: …………", "Awarded score: …………")),
              ]),
              e.meta.instructions &&
                h("p", { class: "exam-instructions" }, e.meta.instructions),
            ]),
            ...e.questions.map((q) => {
              if (q.type === "section")
                return h(
                  "section",
                  {
                    class: "print-section",
                    "data-break": q.pageBreak ? "true" : undefined,
                  },
                  [rich(q.body)],
                );
              index++;
              return h(
                "article",
                {
                  class: "print-question",
                  "data-break": q.pageBreak ? "true" : undefined,
                },
                [
                  h("div", { class: "question-top" }, [
                    h("b", n(index)),
                    h("span", n(q.marks)),
                  ]),
                  ...(q.body.content || []).map(rich),
                  q.type === "mcq" &&
                    h(
                      "div",
                      { class: "print-options" },
                      q.options.map((o, i) =>
                        h("div", [h("span", "○ " + n(i + 1) + ") "), o]),
                      ),
                    ),
                  ...(props.kind === "answer-key"
                    ? [
                        h(
                          "p",
                          { class: "model-answer" },
                          t("پاسخ: ", "Answer: ") +
                            (q.answer || t("ثبت نشده", "Not provided")),
                        ),
                      ]
                    : q.type === "written"
                      ? Array.from({ length: q.lines }, () =>
                          h(
                            "div",
                            {
                              class: q.lined
                                ? "response-line"
                                : "response-space",
                            },
                            "\u00a0",
                          ),
                        )
                      : []),
                ],
              );
            }),
            e.meta.closing &&
              h("div", { class: "exam-closing" }, e.meta.closing),
          ]),
          h("div", { class: "print-pages" }),
        ],
      );
    };
  },
};
