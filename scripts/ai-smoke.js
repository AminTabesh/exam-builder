// Explicit live check: makes two small Groq calls, never run by the automated suite.
import "../apps/backend/src/config/env.js";
import { generateWithGroq } from "../apps/backend/src/modules/ai/groq.js";
import { convertGeneration } from "@exam/shared/ai.js";
import { newExam, validateForExport } from "@exam/shared/exam.js";
if (!process.env.GROQ_API_KEY) {
  console.error("Set GROQ_API_KEY in the root .env first.");
  process.exit(1);
}
for (const language of ["fa", "en"]) {
  const input = {
    requestKey: crypto.randomUUID(),
    topic: language === "fa" ? "چرخه آب" : "The water cycle",
    source:
      language === "fa"
        ? "گرمای خورشید آب را تبخیر می‌کند. بخار آب در هوای سرد متراکم می‌شود و ابر تشکیل می‌دهد. قطره‌های آب به صورت باران به زمین بازمی‌گردند."
        : "Heat from the Sun evaporates water. Water vapor condenses in cool air to form clouds. Water droplets fall back to Earth as rain.",
    subject: "Science",
    grade: "5",
    language,
    difficulty: "easy",
    instructions: "",
    counts: { mcq: 1, blank: 1, written: 1 },
    marks: "1",
  };
  try {
    const output = await generateWithGroq(input);
    const questions = convertGeneration(output, input);
    const exam = newExam();
    exam.meta.title = "AI check";
    exam.meta.course = "Science";
    exam.questions = questions;
    const issues = validateForExport(exam);
    if (issues.length)
      throw new Error("Generated questions failed export validation");
    console.log(
      JSON.stringify({
        language,
        count: questions.length,
        questions: output.questions,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        language,
        code: error.code || error.name,
        message: error.message,
      }),
    );
    process.exitCode = 1;
    break;
  }
}
