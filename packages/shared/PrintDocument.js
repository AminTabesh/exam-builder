import { visualStyle } from "./visualLayout.js";
import { resourceUrl } from "./resources.js";
import { parabolaSvg } from "./parabola.js";
import { matchingBoard } from "./MatchingPrint.js";
import { matchingLabel } from "./matching.js";
import { mathSegments, renderFormula } from "./math.js";
import { drawingSvg } from "./drawing.js";
import { fontFamily, customFontCss } from "./fonts.js";
import { h } from "vue";
import { digits, total, count, printStyles } from "./exam.js";
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
      html = renderFormula(node.attrs?.latex || "");
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
  if (node.type === "parabola")
    return h(
      "div",
      { class: "exam-drawing", style: visualStyle(node.attrs, node.type) },
      [parabolaSvg(node.attrs?.parabola)],
    );
  if (node.type === "drawing")
    return node.attrs?.drawing
      ? h(
          "div",
          {
            class: "exam-drawing",
            dir: "ltr",
            style: visualStyle(node.attrs, node.type),
          },
          [drawingSvg(node.attrs.drawing)],
        )
      : null;
  if (node.type === "image")
    return h("img", {
      src: resourceUrl(node.attrs?.src),
      alt: node.attrs?.alt || "",
      class: `image-align-${node.attrs?.imageAlign || "start"}`,
      style: visualStyle(node.attrs, node.type),
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
      class: node.type === "doc" ? "rich-content" : undefined,
      start: node.type === "orderedList" ? node.attrs?.start : undefined,
      type: node.type === "orderedList" ? node.attrs?.type : undefined,
      style: node.attrs?.textAlign
        ? { textAlign: node.attrs.textAlign }
        : undefined,
    },
    node.type === "doc"
      ? richBlocks(node.content || [])
      : (node.content || []).map(rich),
  );
}
export function renderMathText(value) {
  return mathSegments(value).map((part) => {
    if (part.latex === undefined) return part.text;
    try {
      return h("span", {
        class: "formula",
        dir: "ltr",
        innerHTML: renderFormula(part.latex),
      });
    } catch {
      return h("span", { class: "invalid-formula", dir: "ltr" }, part.latex);
    }
  });
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
          class: `print-document style-${e.layout.style || "formal"}${printStyles.find((style) => style.id === e.layout.style)?.mode === "colorful" ? " colorful" : ""}`,
          "data-style": e.layout.style || "formal",
          dir: en ? "ltr" : "rtl",
          style: {
            "--exam-font": e.layout.fontSize + "pt",
            fontFamily: `${en ? '"Exam English Digits", ' : ""}"${fontFamily(e.layout.fontFamily)}", sans-serif`,
          },
        },
        [
          customFontCss(e.layout.fontFamily)
            ? h("style", { innerHTML: customFontCss(e.layout.fontFamily) })
            : null,
          h("div", { class: "print-source" }, [
            h(
              "header",
              { class: `exam-header ${e.meta.logo ? "has-logo" : ""}` },
              [
                e.meta.opening &&
                  h("div", { class: "opening" }, e.meta.opening),
                h("div", { class: "header-title" }, [
                  e.meta.logo &&
                    h("img", {
                      class: `exam-logo logo-${e.meta.logoPosition || "right"}`,
                      src: resourceUrl(e.meta.logo),
                    }),
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
                  field(
                    t("تاریخ", "Date"),
                    e.meta.date
                      ? h(
                          "span",
                          { class: "exam-date", dir: "ltr" },
                          n(e.meta.date),
                        )
                      : "",
                  ),
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
                  h(
                    "p",
                    {
                      class: "exam-instructions",
                      style: {
                        textAlign: e.meta.instructionsAlign || "center",
                      },
                    },
                    e.meta.instructions,
                  ),
              ],
            ),
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
                  ...richBlocks(q.body.content || []),
                  q.type === "matching" &&
                    matchingBoard(q, rich, e.layout.language, props.kind),
                  q.type === "matching" &&
                    props.kind === "answer-key" &&
                    q.matching?.pairs.length > 0 &&
                    h("p", { class: "matching-answer-summary" }, [
                      t("اتصال‌های صحیح: ", "Correct pairs: "),
                      q.matching.pairs
                        .map(
                          (pair) =>
                            `${matchingLabel(
                              "left",
                              q.matching.left.findIndex(
                                (item) => item.id === pair.leftId,
                              ),
                              e.layout.language,
                            )} ↔ ${matchingLabel(
                              "right",
                              q.matching.right.findIndex(
                                (item) => item.id === pair.rightId,
                              ),
                              e.layout.language,
                            )}`,
                        )
                        .join(en ? ", " : "، "),
                    ]),
                  q.type === "mcq" &&
                    h(
                      "div",
                      { class: "print-options" },
                      q.options.map((o, i) =>
                        h("div", [
                          h("span", "○ " + n(i + 1) + ") "),
                          ...(typeof o === "string"
                            ? renderMathText(o)
                            : [rich(o)]),
                        ]),
                      ),
                    ),
                  ...(props.kind === "answer-key" &&
                  (q.type !== "matching" || q.answer)
                    ? [
                        h("p", { class: "model-answer" }, [
                          t("پاسخ: ", "Answer: "),
                          ...renderMathText(
                            q.answer || t("ثبت نشده", "Not provided"),
                          ),
                        ]),
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
                  ...(props.kind === "student"
                    ? Array.from({ length: q.answerSpace || 0 }, () =>
                        h(
                          "div",
                          {
                            class: q.lined ? "response-line" : "response-space",
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

// A float and the paragraphs it wraps must move together during pagination.
export function richBlocks(nodes) {
  const output = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (
      ["image", "drawing", "parabola"].includes(n.type) &&
      ["left", "right"].includes(n.attrs?.wrap)
    ) {
      const group = [rich(n)];
      while (
        i + 1 < nodes.length &&
        ["paragraph", "heading", "bulletList", "orderedList"].includes(
          nodes[i + 1].type,
        )
      )
        group.push(rich(nodes[++i]));
      output.push(h("div", { class: "visual-wrap-group" }, group));
    } else output.push(rich(n));
  }
  return output;
}
