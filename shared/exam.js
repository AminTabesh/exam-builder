import { z } from "zod";
import katex from "katex";
export const uid = () => globalThis.crypto.randomUUID();
export const digits = (value, lang = "fa") =>
  lang === "fa"
    ? latin(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d])
    : latin(value);
export const latin = (v) =>
  String(v)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace("٫", ".");
export function hundredths(v) {
  const s = latin(v);
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s))
    throw new Error("نمره را با حداکثر دو رقم اعشار وارد کنید.");
  const [whole, fraction = ""] = s.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export const total = (exam) =>
  exam.questions
    .filter((q) => q.type !== "section")
    .reduce((sum, q) => {
      try {
        return sum + hundredths(q.marks);
      } catch {
        return sum;
      }
    }, 0);
export const count = (exam) =>
  exam.questions.filter((q) => q.type !== "section").length;
export const paragraph = (text) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
  ],
});
export const plain = (doc) =>
  doc?.text || (doc?.content || []).map(plain).join(" ");
export function newQuestion(type = "written") {
  return {
    id: uid(),
    type,
    body: paragraph(""),
    marks: type === "section" ? "0" : "1",
    options: ["", "", "", ""],
    answer: "",
    lines: 4,
    lined: true,
    pageBreak: false,
  };
}
export function newExam() {
  return {
    schemaVersion: 1,
    meta: {
      title: "",
      course: "",
      institution: "",
      instructor: "",
      date: "",
      calendar: "jalali",
      startTime: "",
      duration: "60",
      year: "",
      grade: "",
      field: "",
      faculty: "",
      department: "",
      courseCode: "",
      semester: "",
      opening: "به نام خدا",
      instructions: "پاسخ‌ها را خوانا و با خودکار آبی یا مشکی بنویسید.",
      closing: "موفق باشید.",
      logo: "",
      awardedScore: false,
    },
    layout: { language: "fa", template: "school", fontSize: 12 },
    questions: [],
  };
}
export function exampleExam(language = "fa") {
  const e = newExam();
  Object.assign(e.meta, {
    title: language === "fa" ? "آزمون میان‌ترم ریاضی" : "Mathematics · Midterm",
    course: language === "fa" ? "ریاضی" : "Mathematics",
    institution: language === "fa" ? "دبیرستان دانش" : "Danesh School",
    grade: language === "fa" ? "پایه دهم" : "Grade 10",
    instructor: language === "fa" ? "مریم احمدی" : "Maryam Ahmadi",
    duration: "60",
    year: "۱۴۰۵–۱۴۰۶",
  });
  e.layout.language = language;
  if (language === "en")
    Object.assign(e.meta, {
      calendar: "gregorian",
      opening: "",
      instructions: "Answer all questions. Show your working.",
      closing: "Good luck.",
    });
  e.questions = [
    Object.assign(newQuestion("mcq"), {
      body: paragraph(
        language === "fa"
          ? "کدام عدد، یک عدد اول است؟"
          : "Which number is prime?",
      ),
      options: ["۱۲", "۱۷", "۲۱", "۲۷"].map((x) =>
        language === "en" ? latin(x) : x,
      ),
      marks: "4",
      answer: language === "fa" ? "۱۷" : "17",
    }),
    Object.assign(newQuestion("blank"), {
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text:
                  language === "fa"
                    ? "مجموع زاویه‌های داخلی یک مثلث برابر با "
                    : "The angles of a triangle sum to ",
              },
              { type: "blank", attrs: { width: 90 } },
              {
                type: "text",
                text: language === "fa" ? " درجه است." : " degrees.",
              },
            ],
          },
        ],
      },
      marks: "6",
      answer: "180",
    }),
    Object.assign(newQuestion(), {
      body: paragraph(
        language === "fa"
          ? "مساحت مستطیلی به طول ۸ و عرض ۵ سانتی‌متر را حساب کنید. راه‌حل خود را بنویسید."
          : "Find the area of a rectangle with length 8 cm and width 5 cm. Show your working.",
      ),
      marks: "10",
      lines: 5,
      answer: language === "fa" ? "۴۰ سانتی‌متر مربع" : "40 square centimetres",
    }),
  ];
  return e;
}
const text = z.string().max(4000);
const mark = z
  .object({
    type: z.enum(["bold", "italic", "strike", "code", "underline"]),
    attrs: z.record(z.unknown()).optional(),
  })
  .strict();
const node = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "doc",
        "paragraph",
        "text",
        "hardBreak",
        "bold",
        "bulletList",
        "orderedList",
        "listItem",
        "heading",
        "blockquote",
        "horizontalRule",
        "formula",
        "blank",
        "image",
      ]),
      text: z.string().max(20000).optional(),
      attrs: z
        .object({
          level: z.number().min(1).max(6).optional(),
          start: z.number().optional(),
          type: z.enum(["1", "a", "A", "i", "I"]).nullable().optional(),
          latex: z.string().max(2000).optional(),
          width: z.number().min(20).max(650).optional(),
          src: z
            .string()
            .regex(/^\/api\/assets\/[a-f0-9-]+$/)
            .optional(),
          alt: z.string().max(200).optional(),
          dir: z.enum(["rtl", "ltr", "auto"]).optional(),
        })
        .strict()
        .optional(),
      marks: z.array(mark).max(5).optional(),
      content: z.array(node).max(500).optional(),
    })
    .strict(),
);
const marks = z.string().refine((v) => {
  try {
    hundredths(v);
    return true;
  } catch {
    return false;
  }
}, "نمره نامعتبر است.");
export const examSchema = z
  .object({
    schemaVersion: z.literal(1),
    meta: z
      .object({
        title: text,
        course: text,
        institution: text,
        instructor: text,
        date: text,
        calendar: z.enum(["jalali", "gregorian"]),
        startTime: text,
        duration: text,
        year: text,
        grade: text,
        field: text,
        faculty: text,
        department: text,
        courseCode: text,
        semester: text,
        opening: text,
        instructions: text,
        closing: text,
        logo: z.union([
          z.literal(""),
          z.string().regex(/^\/api\/assets\/[a-f0-9-]+$/),
        ]),
        awardedScore: z.boolean(),
      })
      .strict(),
    layout: z
      .object({
        language: z.enum(["fa", "en"]),
        template: z.enum(["school", "university"]),
        fontSize: z.number().min(10).max(16),
        target: z.unknown().optional(),
      })
      .strict()
      .transform(({ target, ...layout }) => layout),
    questions: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            type: z.enum(["mcq", "blank", "written", "section"]),
            body: node,
            marks,
            options: z.array(z.string().max(2000)).min(2).max(6),
            answer: text,
            lines: z.number().int().min(0).max(50),
            lined: z.boolean(),
            pageBreak: z.boolean(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export function validateForExport(e) {
  const errors = [];
  if (!e.meta.title.trim()) errors.push("عنوان آزمون را بنویسید.");
  if (!e.meta.course.trim()) errors.push("نام درس را بنویسید.");
  if (!count(e)) errors.push("دست‌کم یک سؤال اضافه کنید.");
  e.questions.forEach((q, i) => {
    const walk = (node) => {
      if (node.type === "formula") {
        try {
          if (!node.attrs?.latex) throw new Error();
          katex.renderToString(node.attrs.latex, {
            throwOnError: true,
            trust: false,
            strict: "error",
            maxExpand: 1000,
          });
        } catch {
          errors.push(
            `فرمول سؤال ${digits(i + 1)} معتبر نیست. فرمول را اصلاح کنید.`,
          );
        }
      }
      if (node.type === "image" && !node.attrs?.src)
        errors.push(`تصویر سؤال ${digits(i + 1)} معتبر نیست.`);
      node.content?.forEach(walk);
    };
    walk(q.body);
    if (
      !plain(q.body).trim() &&
      !JSON.stringify(q.body).includes("image") &&
      !JSON.stringify(q.body).includes("formula")
    )
      errors.push(`متن سؤال ${digits(i + 1)} را بنویسید.`);
    if (q.type === "mcq" && q.options.some((o) => !o.trim()))
      errors.push(`گزینه‌های سؤال ${digits(i + 1)} را کامل کنید.`);
    if (q.type === "blank" && !JSON.stringify(q.body).includes('"blank"'))
      errors.push(`در سؤال ${digits(i + 1)} جای خالی درج کنید.`);
    try {
      hundredths(q.marks);
    } catch {
      errors.push(`نمره سؤال ${digits(i + 1)} درست نیست.`);
    }
  });
  return errors;
}
export function assetIds(exam) {
  const ids = new Set();
  const walk = (n) => {
    if (n?.type === "image" && n.attrs?.src)
      ids.add(n.attrs.src.split("/").pop());
    n?.content?.forEach(walk);
  };
  exam.questions.forEach((q) => walk(q.body));
  if (exam.meta.logo) ids.add(exam.meta.logo.split("/").pop());
  return [...ids];
}

// Bound tree complexity before the recursive schema visits untrusted structured content.
export function parseExam(input) {
  const stack = [{ value: input, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (++visited > 50000 || depth > 30)
      throw Object.assign(
        new Error("محتوای آزمون بیش از حد پیچیده است. متن را ساده‌تر کنید."),
        { status: 422 },
      );
    if (value && typeof value === "object")
      for (const item of Object.values(value))
        if (item && typeof item === "object")
          stack.push({ value: item, depth: depth + 1 });
  }
  return examSchema.parse(input);
}
