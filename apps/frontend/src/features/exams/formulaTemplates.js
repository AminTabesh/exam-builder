import { renderFormula } from "@exam/shared/math.js";
const template = (label, code, fields = []) => ({
  label,
  code,
  fields: fields.map(([key, label]) => ({ key, label })),
});
export const formulaGroups = [
  {
    name: "پایه",
    items: [
      template("متغیر", "{{value}}", [["value", "نام یا مقدار متغیر"]]),
      template("توان", "{{base}}^{ {{power}} }", [
        ["base", "پایه"],
        ["power", "توان"],
      ]),
      template("زیرنویس", "{{base}}_{ {{index}} }", [
        ["base", "نماد"],
        ["index", "زیرنویس"],
      ]),
      template("کسر", String.raw`\frac{ {{top}} }{ {{bottom}} }`, [
        ["top", "صورت"],
        ["bottom", "مخرج"],
      ]),
      template("ریشه دوم", String.raw`\sqrt{ {{value}} }`, [
        ["value", "عبارت زیر رادیکال"],
      ]),
      template("ریشه دلخواه", String.raw`\sqrt[{{degree}}]{ {{value}} }`, [
        ["degree", "درجه ریشه"],
        ["value", "عبارت زیر رادیکال"],
      ]),
      ...[
        ["مثبت و منفی", "\\pm"],
        ["ضرب", "\\times"],
        ["تقسیم", "\\div"],
      ].map(([l, c]) => template(l, c)),
    ],
  },
  {
    name: "بردار و فیزیک",
    items: [
      template("بردار", String.raw`\vec{ {{value}} }`, [
        ["value", "نام بردار"],
      ]),
      template("بردار بین دو نقطه", String.raw`\overrightarrow{ {{points}} }`, [
        ["points", "نام دو نقطه"],
      ]),
      template("بردار یکه", String.raw`\hat{ {{value}} }`, [
        ["value", "نام بردار یکه"],
      ]),
      template("ضرب داخلی", String.raw`\vec{ {{a}} } \cdot \vec{ {{b}} }`, [
        ["a", "بردار اول"],
        ["b", "بردار دوم"],
      ]),
      template("ضرب برداری", String.raw`\vec{ {{a}} } \times \vec{ {{b}} }`, [
        ["a", "بردار اول"],
        ["b", "بردار دوم"],
      ]),
      template(
        "بردار ستونی",
        String.raw`\begin{pmatrix} {{a}} \\ {{b}} \\ {{c}} \end{pmatrix}`,
        [
          ["a", "مؤلفه اول"],
          ["b", "مؤلفه دوم"],
          ["c", "مؤلفه سوم"],
        ],
      ),
    ],
  },
  {
    name: "جبر و نمادها",
    items: [
      ["کوچک‌تر یا مساوی", "\\leq"],
      ["بزرگ‌تر یا مساوی", "\\geq"],
      ["نامساوی", "\\neq"],
      ["تقریباً برابر", "\\approx"],
      ["بی‌نهایت", "\\infty"],
      ["عضویت", "\\in"],
      ["زیرمجموعه", "\\subseteq"],
      ["برای هر", "\\forall"],
      ["وجود دارد", "\\exists"],
    ].map(([l, c]) => template(l, c)),
  },
  {
    name: "حسابان",
    items: [
      template(
        "مجموع",
        String.raw`\sum_{ {{index}} = {{start}} }^{ {{end}} } {{value}}`,
        [
          ["index", "متغیر شمارنده"],
          ["start", "حد پایین"],
          ["end", "حد بالا"],
          ["value", "عبارت"],
        ],
      ),
      template(
        "حاصل‌ضرب",
        String.raw`\prod_{ {{index}} = {{start}} }^{ {{end}} } {{value}}`,
        [
          ["index", "متغیر شمارنده"],
          ["start", "حد پایین"],
          ["end", "حد بالا"],
          ["value", "عبارت"],
        ],
      ),
      template(
        "انتگرال",
        String.raw`\int_{ {{start}} }^{ {{end}} } {{value}} \, d{{variable}}`,
        [
          ["start", "حد پایین"],
          ["end", "حد بالا"],
          ["value", "تابع"],
          ["variable", "متغیر انتگرال"],
        ],
      ),
      template(
        "حد",
        String.raw`\lim_{ {{variable}} \to {{point}} } {{value}}`,
        [
          ["variable", "متغیر"],
          ["point", "نقطه"],
          ["value", "تابع"],
        ],
      ),
      template("مشتق", String.raw`\frac{d}{d{{variable}}} {{value}}`, [
        ["variable", "متغیر مشتق"],
        ["value", "تابع"],
      ]),
      template("مشتق جزئی", "\\partial"),
    ],
  },
  {
    name: "هندسه و یونانی",
    items: [
      ["پی", "\\pi"],
      ["تتا", "\\theta"],
      ["آلفا", "\\alpha"],
      ["بتا", "\\beta"],
      ["دلتا", "\\Delta"],
      ["زاویه", "\\angle"],
      ["عمود", "\\perp"],
      ["موازی", "\\parallel"],
      ["درجه", "\\circ"],
    ].map(([l, c]) => template(l, c)),
  },
];

formulaGroups[0].items.push(
  template("جمع", "+"),
  template("تفریق", "-"),
  template("تساوی", "="),
);

// Extended palette: both visual slots and advanced templates share this catalog.
formulaGroups
  .find((group) => group.name === "حسابان")
  .items.push(
    template("انتگرال نامعین", "\\int {{value}}\\,d{{variable}}", [
      ["value", "تابع"],
      ["variable", "متغیر"],
    ]),
    template("انتگرال دوگانه", "\\iint_{ {{domain}} } {{value}}\\,d{{area}}", [
      ["domain", "ناحیه"],
      ["value", "تابع"],
      ["area", "عنصر سطح"],
    ]),
    template(
      "انتگرال سه‌گانه",
      "\\iiint_{ {{domain}} } {{value}}\\,d{{volume}}",
      [
        ["domain", "ناحیه"],
        ["value", "تابع"],
        ["volume", "عنصر حجم"],
      ],
    ),
    template("انتگرال بسته", "\\oint_{ {{path}} } {{value}}\\,d{{variable}}", [
      ["path", "مسیر"],
      ["value", "تابع"],
      ["variable", "متغیر"],
    ]),
    template(
      "مشتق مرتبه دلخواه",
      "\\frac{d^{ {{order}} } {{value}} }{d{{variable}}^{ {{order}} }}",
      [
        ["order", "مرتبه"],
        ["value", "تابع"],
        ["variable", "متغیر"],
      ],
    ),
    template(
      "کسر مشتق جزئی",
      "\\frac{\\partial {{value}}}{\\partial {{variable}}}",
      [
        ["value", "تابع"],
        ["variable", "متغیر"],
      ],
    ),
    template("حد راست", "\\lim_{ {{variable}}\\to {{point}}^{+}} {{value}}", [
      ["variable", "متغیر"],
      ["point", "نقطه"],
      ["value", "تابع"],
    ]),
    template("حد چپ", "\\lim_{ {{variable}}\\to {{point}}^{-}} {{value}}", [
      ["variable", "متغیر"],
      ["point", "نقطه"],
      ["value", "تابع"],
    ]),
    template(
      "مجموع نامتناهی",
      "\\sum_{ {{index}} = {{start}} }^{\\infty} {{value}}",
      [
        ["index", "شمارنده"],
        ["start", "شروع"],
        ["value", "عبارت"],
      ],
    ),
  );
formulaGroups.push(
  {
    name: "حروف یونانی",
    items: [
      template("گاما", "\\gamma", []),
      template("دلتا کوچک", "\\delta", []),
      template("اپسیلون", "\\epsilon", []),
      template("زتا", "\\zeta", []),
      template("اتا", "\\eta", []),
      template("یوتا", "\\iota", []),
      template("کاپا", "\\kappa", []),
      template("لامبدا", "\\lambda", []),
      template("مو", "\\mu", []),
      template("نو", "\\nu", []),
      template("کسی", "\\xi", []),
      template("اومیکرون", "\\omicron", []),
      template("رو", "\\rho", []),
      template("سیگما", "\\sigma", []),
      template("تاو", "\\tau", []),
      template("آپسیلون", "\\upsilon", []),
      template("فی", "\\phi", []),
      template("خی", "\\chi", []),
      template("پسی", "\\psi", []),
      template("امگا", "\\omega", []),
      template("گاما بزرگ", "\\Gamma", []),
      template("تتا بزرگ", "\\Theta", []),
      template("لامبدا بزرگ", "\\Lambda", []),
      template("کسی بزرگ", "\\Xi", []),
      template("پی بزرگ", "\\Pi", []),
      template("سیگما بزرگ", "\\Sigma", []),
      template("آپسیلون بزرگ", "\\Upsilon", []),
      template("فی بزرگ", "\\Phi", []),
      template("پسی بزرگ", "\\Psi", []),
      template("امگا بزرگ", "\\Omega", []),
      template("اپسیلون متغیر", "\\varepsilon", []),
      template("تتا متغیر", "\\vartheta", []),
      template("فی متغیر", "\\varphi", []),
      template("رو متغیر", "\\varrho", []),
      template("سیگما پایانی", "\\varsigma", []),
    ],
  },
  {
    name: "توابع و مثلثات",
    items: [
      template("سینوس", "\\sin\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("کسینوس", "\\cos\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("تانژانت", "\\tan\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("کتانژانت", "\\cot\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("سکانت", "\\sec\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("کسکانت", "\\csc\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("آرک سینوس", "\\arcsin\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("آرک کسینوس", "\\arccos\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("آرک تانژانت", "\\arctan\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("سینوس هذلولوی", "\\sinh\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("کسینوس هذلولوی", "\\cosh\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("تانژانت هذلولوی", "\\tanh\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("لگاریتم طبیعی", "\\ln\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("لگاریتم", "\\log\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template("نمایی", "\\exp\\left( {{value}} \\right)", [
        ["value", "عبارت"],
      ]),
      template(
        "لگاریتم با پایه",
        "\\log_{ {{base}} }\\left( {{value}} \\right)",
        [
          ["base", "پایه لگاریتم"],
          ["value", "عبارت"],
        ],
      ),
      template("تابع", "{{function}}\\left( {{argument}} \\right)", [
        ["function", "نام تابع"],
        ["argument", "ورودی"],
      ]),
    ],
  },
  {
    name: "ماتریس و جبر خطی",
    items: [
      template(
        "ماتریس پرانتزی 2×2",
        "\\begin{pmatrix}{{a11}} & {{a12}} \\\\ {{a21}} & {{a22}}\\end{pmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
        ],
      ),
      template(
        "ماتریس براکتی 2×2",
        "\\begin{bmatrix}{{a11}} & {{a12}} \\\\ {{a21}} & {{a22}}\\end{bmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
        ],
      ),
      template(
        "دترمینان 2×2",
        "\\begin{vmatrix}{{a11}} & {{a12}} \\\\ {{a21}} & {{a22}}\\end{vmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
        ],
      ),
      template(
        "ماتریس پرانتزی 3×3",
        "\\begin{pmatrix}{{a11}} & {{a12}} & {{a13}} \\\\ {{a21}} & {{a22}} & {{a23}} \\\\ {{a31}} & {{a32}} & {{a33}}\\end{pmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a13", "سطر 1 ستون 3"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
          ["a23", "سطر 2 ستون 3"],
          ["a31", "سطر 3 ستون 1"],
          ["a32", "سطر 3 ستون 2"],
          ["a33", "سطر 3 ستون 3"],
        ],
      ),
      template(
        "ماتریس براکتی 3×3",
        "\\begin{bmatrix}{{a11}} & {{a12}} & {{a13}} \\\\ {{a21}} & {{a22}} & {{a23}} \\\\ {{a31}} & {{a32}} & {{a33}}\\end{bmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a13", "سطر 1 ستون 3"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
          ["a23", "سطر 2 ستون 3"],
          ["a31", "سطر 3 ستون 1"],
          ["a32", "سطر 3 ستون 2"],
          ["a33", "سطر 3 ستون 3"],
        ],
      ),
      template(
        "دترمینان 3×3",
        "\\begin{vmatrix}{{a11}} & {{a12}} & {{a13}} \\\\ {{a21}} & {{a22}} & {{a23}} \\\\ {{a31}} & {{a32}} & {{a33}}\\end{vmatrix}",
        [
          ["a11", "سطر 1 ستون 1"],
          ["a12", "سطر 1 ستون 2"],
          ["a13", "سطر 1 ستون 3"],
          ["a21", "سطر 2 ستون 1"],
          ["a22", "سطر 2 ستون 2"],
          ["a23", "سطر 2 ستون 3"],
          ["a31", "سطر 3 ستون 1"],
          ["a32", "سطر 3 ستون 2"],
          ["a33", "سطر 3 ستون 3"],
        ],
      ),
      template(
        "تابع چندضابطه‌ای",
        "\\begin{cases} {{a}} & {{conditiona}} \\\\ {{b}} & {{conditionb}} \\end{cases}",
        [
          ["a", "عبارت اول"],
          ["conditiona", "شرط اول"],
          ["b", "عبارت دوم"],
          ["conditionb", "شرط دوم"],
        ],
      ),
      template("ترانهاده", "{{value}}^{\\mathsf{T}}", [["value", "ماتریس"]]),
      template("ماتریس معکوس", "{{value}}^{-1}", [["value", "ماتریس"]]),
      template("نرم", "\\left\\lVert {{value}} \\right\\rVert", [
        ["value", "بردار یا ماتریس"],
      ]),
      template(
        "دستگاه دو معادله",
        "\\begin{cases} {{first}} \\\\ {{second}} \\end{cases}",
        [
          ["first", "معادله اول"],
          ["second", "معادله دوم"],
        ],
      ),
      template("نقاط قطری", "\\ddots", []),
      template("نقاط عمودی", "\\vdots", []),
    ],
  },
  {
    name: "مجموعه‌ها و منطق",
    items: [
      template("عضو نیست", "\\notin", []),
      template("شامل", "\\ni", []),
      template("زیرمجموعه محض", "\\subset", []),
      template("زیرمجموعه نیست", "\\nsubseteq", []),
      template("ابرمجموعه", "\\supseteq", []),
      template("ابرمجموعه محض", "\\supset", []),
      template("اجتماع", "\\cup", []),
      template("اشتراک", "\\cap", []),
      template("تفاضل مجموعه", "\\setminus", []),
      template("مجموعه تهی", "\\varnothing", []),
      template("و منطقی", "\\land", []),
      template("یا منطقی", "\\lor", []),
      template("نقیض", "\\neg", []),
      template("نتیجه می‌دهد", "\\implies", []),
      template("اگر و تنها اگر", "\\iff", []),
      template("وجود ندارد", "\\nexists", []),
      template("در نتیجه", "\\therefore", []),
      template("زیرا", "\\because", []),
      template("هم‌ارزی", "\\equiv", []),
      template("اعداد طبیعی", "\\mathbb{N}", []),
      template("اعداد صحیح", "\\mathbb{Z}", []),
      template("اعداد گویا", "\\mathbb{Q}", []),
      template("اعداد حقیقی", "\\mathbb{R}", []),
      template("اعداد مختلط", "\\mathbb{C}", []),
      template(
        "مجموعه شرطی",
        "\\left\\{ {{value}} \\mid {{condition}} \\right\\}",
        [
          ["value", "عضو"],
          ["condition", "شرط"],
        ],
      ),
      template("بازه بسته", "\\left[ {{start}}, {{end}} \\right]", [
        ["start", "ابتدا"],
        ["end", "انتها"],
      ]),
      template("بازه باز", "\\left( {{start}}, {{end}} \\right)", [
        ["start", "ابتدا"],
        ["end", "انتها"],
      ]),
    ],
  },
  {
    name: "آمار و احتمال",
    items: [
      template("ترکیب", "\\binom{ {{n}} }{ {{k}} }", [
        ["n", "تعداد کل"],
        ["k", "تعداد انتخاب"],
      ]),
      template("فاکتوریل", "{{value}}!", [["value", "عدد"]]),
      template("احتمال", "P\\left( {{event}} \\right)", [["event", "پیشامد"]]),
      template(
        "احتمال شرطی",
        "P\\left( {{event}} \\mid {{condition}} \\right)",
        [
          ["event", "پیشامد"],
          ["condition", "شرط"],
        ],
      ),
      template("امید ریاضی", "\\mathbb{E}\\left[ {{value}} \\right]", [
        ["value", "متغیر تصادفی"],
      ]),
      template("واریانس", "\\operatorname{Var}\\left( {{value}} \\right)", [
        ["value", "متغیر تصادفی"],
      ]),
      template("میانگین", "\\overline{ {{value}} }", [["value", "متغیر"]]),
      template("برآوردگر", "\\widehat{ {{value}} }", [["value", "متغیر"]]),
      template(
        "توزیع نرمال",
        "\\mathcal{N}\\left( {{mean}}, {{variance}} \\right)",
        [
          ["mean", "میانگین"],
          ["variance", "واریانس"],
        ],
      ),
    ],
  },
  {
    name: "پرانتز و نشانه‌گذاری",
    items: [
      template("پرانتز", "\\left( {{value}} \\right)", [["value", "عبارت"]]),
      template("براکت", "\\left[ {{value}} \\right]", [["value", "عبارت"]]),
      template("آکولاد", "\\left\\{ {{value}} \\right\\}", [
        ["value", "عبارت"],
      ]),
      template("قدر مطلق", "\\left| {{value}} \\right|", [["value", "عبارت"]]),
      template("کف", "\\left\\lfloor {{value}} \\right\\rfloor", [
        ["value", "عبارت"],
      ]),
      template("سقف", "\\left\\lceil {{value}} \\right\\rceil", [
        ["value", "عبارت"],
      ]),
      template("علامت مزدوج", "\\overline{ {{value}} }", [["value", "عبارت"]]),
      template("زیرخط", "\\underline{ {{value}} }", [["value", "عبارت"]]),
      template("تأکید زیر عبارت", "\\underbrace{ {{value}} }_{ {{caption}} }", [
        ["value", "عبارت"],
      ]),
      template("سه نقطه", "\\ldots", []),
      template("نقاط میانی", "\\cdots", []),
      template("درصد", "\\%", []),
      template("عدد علمی", "{{value}} \\times 10^{ {{power}} }", [
        ["value", "ضریب"],
        ["power", "توان"],
      ]),
      template("توان و زیرنویس", "{{value}}_{ {{index}} }^{ {{power}} }", [
        ["value", "نماد"],
        ["index", "زیرنویس"],
        ["power", "توان"],
      ]),
    ],
  },
  {
    name: "پیکان‌ها و روابط",
    items: [
      template("پیکان راست", "\\rightarrow", []),
      template("پیکان چپ", "\\leftarrow", []),
      template("پیکان دوطرفه", "\\leftrightarrow", []),
      template("نگاشت", "\\mapsto", []),
      template("پیکان بالا", "\\uparrow", []),
      template("پیکان پایین", "\\downarrow", []),
      template("متناسب", "\\propto", []),
      template("مشابه", "\\sim", []),
      template("هم‌نهشت هندسی", "\\cong", []),
      template("بسیار کوچک‌تر", "\\ll", []),
      template("بسیار بزرگ‌تر", "\\gg", []),
      template("کمتر", "\\lt", []),
      template("بیشتر", "\\gt", []),
      template("منفی و مثبت", "\\mp", []),
      template("نقطه ضرب", "\\cdot", []),
      template("جمع مستقیم", "\\oplus", []),
      template("ضرب تانسوری", "\\otimes", []),
      template("پیکان با توضیح", "\\xrightarrow{ {{value}} }", [
        ["value", "توضیح"],
      ]),
    ],
  },
  {
    name: "فیزیک و نمادهای تکمیلی",
    items: [
      template("نابلا", "\\nabla", []),
      template("اچ بار", "\\hbar", []),
      template("قسمت حقیقی", "\\Re", []),
      template("قسمت موهومی", "\\Im", []),
      template("علامت زاویه‌دار", "\\measuredangle", []),
      template("مثلث", "\\triangle", []),
      template("دایره", "\\odot", []),
      template("علامت قطر", "\\varnothing", []),
      template("تغییرات دلتا", "\\Delta {{value}}", [["value", "کمیت"]]),
      template("مشتق زمانی", "\\dot{ {{value}} }", [["value", "کمیت"]]),
      template("مشتق زمانی دوم", "\\ddot{ {{value}} }", [["value", "کمیت"]]),
      template("گرادیان", "\\nabla {{value}}", [["value", "تابع"]]),
      template("دیورژانس", "\\nabla \\cdot {{value}}", [["value", "بردار"]]),
      template("کرل", "\\nabla \\times {{value}}", [["value", "بردار"]]),
      template("لاپلاسین", "\\nabla^2 {{value}}", [["value", "تابع"]]),
      template("واحد کمیت", "{{value}}\\,\\mathrm{ {{unit}} }", [
        ["value", "مقدار"],
        ["unit", "واحد"],
      ]),
      template("زاویه بر حسب درجه", "{{value}}^{\\circ}", [["value", "زاویه"]]),
    ],
  },
);

// Keep all Greek letters together rather than mixing them into geometry.
const geometryGroup = formulaGroups.find(
  (group) => group.name === "هندسه و یونانی",
);
const greekGroup = formulaGroups.find((group) => group.name === "حروف یونانی");
const greekLabels = ["پی", "تتا", "آلفا", "بتا", "دلتا"];
greekGroup.items.unshift(
  ...geometryGroup.items.filter((item) => greekLabels.includes(item.label)),
);
geometryGroup.items = geometryGroup.items.filter(
  (item) => !greekLabels.includes(item.label),
);
geometryGroup.name = "هندسه";
const underbrace = formulaGroups
  .flatMap((group) => group.items)
  .find((item) => item.label === "تأکید زیر عبارت");
underbrace.fields.push({ key: "caption", label: "توضیح زیر عبارت" });

export const templateLatex = (item, values = {}) =>
  item.code.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => values[key]?.trim() || "\\square",
  );
export function spliceFormula(value, start, end, insertion) {
  return {
    value: value.slice(0, start) + insertion + value.slice(end),
    cursor: start + insertion.length,
  };
}

// Share palette markup across all question and choice editors.
export const renderedFormulaGroups = formulaGroups.map((group) => ({
  ...group,
  items: group.items.map((item) => ({
    ...item,
    html: renderFormula(templateLatex(item)),
  })),
}));
