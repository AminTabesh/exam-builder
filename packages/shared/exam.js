import { parabolaSchema } from "./parabola.js";
import { bundledFonts, defaultFont } from "./fonts.js";
import { mathErrors, renderFormula } from "./math.js";
import { drawingSchema } from "./drawing.js";
import { z } from "zod";
export const uid = () => globalThis.crypto.randomUUID();
export const printStyles = [
  {
    id: "formal",
    label: "جدول رسمی",
    detail: "قالب پیش‌فرض با ستون شماره و بارم",
    mode: "monochrome",
  },
  {
    id: "academic",
    label: "دانشگاهی ممتاز",
    detail: "سربرگ رسمی و جداکننده‌های دقیق",
    mode: "monochrome",
  },
  {
    id: "minimal",
    label: "استاندارد بین‌المللی",
    detail: "شماره‌گذاری حاشیه‌ای و فضای باز",
    mode: "monochrome",
  },
  {
    id: "compact",
    label: "آزمون کوتاه",
    detail: "اطلاعات فشرده و گزینه‌های دو ستونی",
    mode: "monochrome",
  },
  {
    id: "worksheet",
    label: "کاربرگ ساختاریافته",
    detail: "کادر پاسخ و خطوط نوشتن منظم",
    mode: "monochrome",
  },
  {
    id: "cards",
    label: "فرم مؤسسه",
    detail: "اطلاعات طبقه‌بندی‌شده در سربرگ",
    mode: "monochrome",
  },
  {
    id: "band",
    label: "مهندسی کلاسیک",
    detail: "خطوط دوبل و عنوان برجسته",
    mode: "monochrome",
  },
  {
    id: "open",
    label: "پاسخ تشریحی",
    detail: "سربرگ خلوت و فضای بیشتر برای پاسخ",
    mode: "monochrome",
  },
  {
    id: "booklet",
    label: "دفترچه ارزیابی",
    detail: "حاشیه شماره سؤال و بارم مستقل",
    mode: "monochrome",
  },
  {
    id: "modern",
    label: "تحریریه",
    detail: "عنوان نامتقارن و خطوط ظریف",
    mode: "monochrome",
  },
  {
    id: "ocean",
    label: "آبی آکادمیک",
    detail: "سربرگ آبی و شماره‌گذاری یکپارچه",
    mode: "colorful",
    accent: "#2457a7",
  },
  {
    id: "forest",
    label: "سبز پژوهش",
    detail: "خطوط سبز و سربرگ با حاشیه عمودی",
    mode: "colorful",
    accent: "#236754",
  },
  {
    id: "plum",
    label: "ارغوانی ممتاز",
    detail: "عنوان قاب‌دار و جزئیات ارغوانی",
    mode: "colorful",
    accent: "#75406d",
  },
  {
    id: "terracotta",
    label: "آجری معاصر",
    detail: "سربرگ گرم و طراحی تحریریه‌ای",
    mode: "colorful",
    accent: "#994b32",
  },
  {
    id: "navy",
    label: "سرمه‌ای رسمی",
    detail: "نوار عنوان تیره و اطلاعات منظم",
    mode: "colorful",
    accent: "#193d64",
  },
  {
    id: "saffron",
    label: "طلایی دانش",
    detail: "خطوط طلایی و عنوان دوخطی",
    mode: "colorful",
    accent: "#865f16",
  },
  {
    id: "teal",
    label: "فیروزه‌ای مدرن",
    detail: "شماره حاشیه‌ای و سربرگ باز",
    mode: "colorful",
    accent: "#176b78",
  },
  {
    id: "coral",
    label: "مرجانی کاربرگ",
    detail: "کادرهای پاسخ و جزئیات مرجانی",
    mode: "colorful",
    accent: "#a34450",
  },
  {
    id: "indigo",
    label: "نیلی دانشگاهی",
    detail: "عنوان قاب‌دار و خطوط دوبل",
    mode: "colorful",
    accent: "#494b91",
  },
  {
    id: "slate",
    label: "آبی‌خاکستری پژوهش",
    detail: "سربرگ نامتقارن و حاشیه بارم",
    mode: "colorful",
    accent: "#3d6574",
  },
];
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
    answerSpace: 0,
    pageBreak: false,
    ...(type === "matching"
      ? {
          matching: {
            left: [
              { id: uid(), body: paragraph("") },
              { id: uid(), body: paragraph("") },
            ],
            right: [
              { id: uid(), body: paragraph("") },
              { id: uid(), body: paragraph("") },
            ],
            pairs: [],
          },
        }
      : {}),
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
      instructionsAlign: "center",
      closing: "موفق باشید.",
      logo: "",
      logoPosition: "right",
      awardedScore: false,
    },
    layout: {
      language: "fa",
      template: "school",
      style: "formal",
      fontSize: 14,
      fontFamily: defaultFont,
    },
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
const assetSrc = z.union([
  z.string().regex(/^\/api\/assets\/[a-f0-9-]+$/),
  z
    .string()
    .max(500000)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
]);
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
        "drawing",
        "parabola",
      ]),
      text: z.string().max(20000).optional(),
      attrs: z
        .object({
          level: z.number().min(1).max(6).optional(),
          start: z.number().optional(),
          type: z.enum(["1", "a", "A", "i", "I"]).nullable().optional(),
          latex: z.string().max(2000).optional(),
          drawing: drawingSchema.optional(),
          parabola: parabolaSchema.optional(),
          wrap: z.enum(["none", "left", "right"]).optional(),
          width: z.number().min(20).max(650).nullable().optional(),
          src: assetSrc.optional(),
          alt: z.string().max(200).optional(),
          dir: z.enum(["rtl", "ltr", "auto"]).optional(),
          textAlign: z.enum(["start", "center", "end"]).optional(),
          imageAlign: z.enum(["start", "center", "end"]).optional(),
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
export const matchingSchema = z
  .object({
    left: z
      .array(z.object({ id: z.string().uuid(), body: node }).strict())
      .max(12),
    right: z
      .array(z.object({ id: z.string().uuid(), body: node }).strict())
      .max(12),
    pairs: z
      .array(
        z
          .object({ leftId: z.string().uuid(), rightId: z.string().uuid() })
          .strict(),
      )
      .max(12),
  })
  .strict()
  .superRefine((matching, ctx) => {
    const left = new Set(matching.left.map((item) => item.id)),
      right = new Set(matching.right.map((item) => item.id));
    if (
      left.size !== matching.left.length ||
      right.size !== matching.right.length ||
      new Set([...left, ...right]).size !== left.size + right.size
    )
      ctx.addIssue({
        code: "custom",
        message: "شناسه موارد وصل‌کردنی باید یکتا باشد.",
      });
    const usedLeft = new Set(),
      usedRight = new Set();
    for (const pair of matching.pairs) {
      if (
        !left.has(pair.leftId) ||
        !right.has(pair.rightId) ||
        usedLeft.has(pair.leftId) ||
        usedRight.has(pair.rightId)
      )
        ctx.addIssue({
          code: "custom",
          message: "هر پاسخ وصل‌کردنی باید به دو مورد معتبر و یکتا اشاره کند.",
        });
      usedLeft.add(pair.leftId);
      usedRight.add(pair.rightId);
    }
  });
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
        instructionsAlign: z.enum(["left", "center", "right"]).optional(),
        closing: text,
        logo: z.union([z.literal(""), assetSrc]),
        logoPosition: z.enum(["left", "right"]).optional(),
        awardedScore: z.boolean(),
      })
      .strict(),
    layout: z
      .object({
        language: z.enum(["fa", "en"]),
        template: z.enum(["school", "university"]),
        style: z.enum(printStyles.map((style) => style.id)).optional(),
        fontSize: z.number().min(10).max(16),
        fontFamily: z
          .union([
            z.enum(bundledFonts.map((font) => font.id)),
            z.string().uuid(),
          ])
          .default(defaultFont),
        target: z.unknown().optional(),
      })
      .strict()
      .transform(({ target, ...layout }) => layout),
    questions: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            type: z.enum(["mcq", "blank", "written", "matching", "section"]),
            body: node,
            matching: matchingSchema.optional(),
            marks,
            options: z
              .array(z.union([z.string().max(2000), node]))
              .min(2)
              .max(6),
            answer: text,
            lines: z.number().int().min(0).max(50),
            lined: z.boolean(),
            answerSpace: z.number().int().min(0).max(50).optional(),
            pageBreak: z.boolean(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .superRefine((exam, ctx) => {
    exam.questions.forEach((q, index) => {
      if (q.type === "matching" && !q.matching)
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "matching"],
          message: "ستون‌های سؤال وصل‌کردنی را وارد کنید.",
        });
      if (q.type !== "matching" && q.matching)
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "matching"],
          message: "ستون‌ها فقط برای سؤال وصل‌کردنی مجازند.",
        });
    });
  });
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
          renderFormula(node.attrs.latex);
        } catch {
          errors.push(
            `فرمول سؤال ${digits(i + 1)} معتبر نیست. فرمول را اصلاح کنید.`,
          );
        }
      }
      if (
        node.type === "parabola" &&
        !parabolaSchema.safeParse(node.attrs?.parabola).success
      )
        errors.push(`سهمی سؤال ${digits(i + 1)} معتبر نیست.`);
      if (
        node.type === "drawing" &&
        (!node.attrs?.drawing || !node.attrs.drawing.shapes.length)
      )
        errors.push(`شکل سؤال ${digits(i + 1)} خالی است.`);
      if (node.type === "image" && !node.attrs?.src)
        errors.push(`تصویر سؤال ${digits(i + 1)} معتبر نیست.`);
      node.content?.forEach(walk);
    };
    walk(q.body);
    if (q.type === "matching" && q.matching) {
      for (const side of ["left", "right"]) {
        if (!q.matching[side].length)
          errors.push(`ستون‌های سؤال وصل‌کردنی ${digits(i + 1)} را کامل کنید.`);
        q.matching[side].forEach((item) => {
          walk(item.body);
          if (
            !plain(item.body).trim() &&
            !/"(formula|image|drawing|parabola|blank)"/.test(
              JSON.stringify(item.body),
            )
          )
            errors.push(`موارد سؤال وصل‌کردنی ${digits(i + 1)} را کامل کنید.`);
        });
      }
    }
    if (
      !plain(q.body).trim() &&
      !JSON.stringify(q.body).includes("image") &&
      !JSON.stringify(q.body).includes("formula") &&
      !JSON.stringify(q.body).includes("drawing") &&
      !JSON.stringify(q.body).includes("parabola")
    )
      errors.push(`متن سؤال ${digits(i + 1)} را بنویسید.`);
    if (q.type === "mcq")
      q.options.forEach((option, optionIndex) => {
        if (typeof option !== "string") {
          walk(option);
          return;
        }
        if (mathErrors(option).length)
          errors.push(
            `فرمول گزینه ${digits(optionIndex + 1)} سؤال ${digits(i + 1)} معتبر نیست.`,
          );
      });
    if (mathErrors(q.answer).length)
      errors.push(`فرمول پاسخ سؤال ${digits(i + 1)} معتبر نیست.`);
    if (q.type === "mcq" && q.options.some(optionEmpty))
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
    if (n?.type === "image" && n.attrs?.src?.startsWith("/api/assets/"))
      ids.add(n.attrs.src.split("/").pop());
    n?.content?.forEach(walk);
  };
  exam.questions.forEach((q) => questionRichBodies(q).forEach(walk));
  if (exam.meta.logo?.startsWith("/api/assets/"))
    ids.add(exam.meta.logo.split("/").pop());
  return [...ids];
}
export function questionRichBodies(question) {
  return [
    question.body,
    ...(question.type === "mcq"
      ? question.options.filter((o) => typeof o !== "string")
      : []),
    ...["left", "right"].flatMap(
      (side) => question.matching?.[side]?.map((item) => item.body) || [],
    ),
  ];
}
export function embeddedImages(exam) {
  const sources = [];
  const walk = (node) => {
    if (node?.type === "image" && node.attrs?.src?.startsWith("data:"))
      sources.push(node.attrs.src);
    node.content?.forEach(walk);
  };
  exam.questions.forEach((q) => questionRichBodies(q).forEach(walk));
  if (exam.meta.logo?.startsWith("data:")) sources.push(exam.meta.logo);
  return sources;
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

export function optionEmpty(value) {
  return typeof value === "string"
    ? !value.trim()
    : !plain(value).trim() &&
        !/"(formula|image|drawing|parabola)"/.test(JSON.stringify(value));
}
