import { exampleExam, printStyles } from "../packages/shared/exam.js";
import { generatePdf } from "../apps/backend/src/modules/exams/pdf.js";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("test-results/template-review", { recursive: true });
const selected = process.argv.slice(2);
for (const language of ["fa", "en"])
  for (const style of printStyles.filter(
    (style) => !selected.length || selected.includes(style.id),
  )) {
    const exam = exampleExam(language);
    exam.layout.style = style.id;
    const pdf = await generatePdf(exam, "student");
    await writeFile(
      `test-results/template-review/${language}-${style.id}.pdf`,
      pdf,
    );
    console.log(language, style.id, pdf.length);
  }
