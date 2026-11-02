import { writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { exampleExam, newQuestion, paragraph } from "../shared/exam.js";
import { generatePdf } from "../server/pdf.js";
await mkdir("test-results/pdfs", { recursive: true });
const temp = await mkdtemp(path.join(tmpdir(), "exam-image-"));
try {
  const image = path.join(temp, "diagram.webp");
  await sharp({
    create: { width: 300, height: 90, channels: 3, background: "#ddd" },
  })
    .webp()
    .toFile(image);
  const assets = new Map([["/api/assets/fixture", image]]);
  for (const language of ["fa", "en"]) {
    const e = exampleExam(language);
    for (const kind of ["student", "answer-key"])
      await writeFile(
        `test-results/pdfs/${language}-${kind}.pdf`,
        await generatePdf(e, kind),
      );
    e.questions[1].pageBreak = true;
    e.questions.push({
      ...newQuestion(),
      marks: "0.25",
      answer: language === "fa" ? "پاسخ ویژه مدرس" : "Teacher-only solution",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "formula", attrs: { latex: "x^2+\\frac{1}{2}=y" } },
            ],
          },
          {
            type: "image",
            attrs: {
              src: "/api/assets/fixture",
              width: 300,
              alt: "Print sizing fixture",
            },
          },
          ...Array.from(
            { length: 50 },
            () =>
              paragraph(
                (language === "fa"
                  ? "متن بلند با نیم‌فاصله، عبارت English و نشانه‌گذاری. "
                  : "Long question with punctuation and multiple safe paragraph boundaries. "
                ).repeat(4),
              ).content[0],
          ),
        ],
      },
      lines: 30,
    });
    for (const kind of ["student", "answer-key"])
      await writeFile(
        `test-results/pdfs/${language}-long-${kind}.pdf`,
        await generatePdf(e, kind, assets),
      );
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(
  "PDF fixtures written to test-results/pdfs. Inspect at 100% print scale.",
);
