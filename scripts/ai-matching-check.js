import "../apps/backend/src/config/env.js";
import { generateWithGroq } from "../apps/backend/src/modules/ai/groq.js";
import { convertGeneration } from "../packages/shared/ai.js";
import { newExam, validateForExport } from "../packages/shared/exam.js";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}));
    console.log(
      JSON.stringify({
        providerStatus: response.status,
        code: body.error?.code,
        message: body.error?.message,
      }),
    );
  }
  return response;
};
for (const language of ["fa", "en"]) {
  const input = {
    requestKey: crypto.randomUUID(),
    topic: language === "fa" ? "کشورها و پایتخت‌ها" : "Countries and capitals",
    source: "",
    subject: "Geography",
    grade: "8",
    language,
    difficulty: "easy",
    instructions: "",
    counts: { mcq: 0, blank: 0, written: 0, matching: 1 },
    marks: "1",
  };
  try {
    let output;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        output = await generateWithGroq(input);
        break;
      } catch (error) {
        if (error.code !== "AI_INVALID_OUTPUT" || attempt === 2) throw error;
      }
    }
    console.log(
      JSON.stringify({
        language,
        types: output.questions?.map((q) => q.type),
        sizes: output.questions?.map((q) => [
          q.leftItems?.length,
          q.rightItems?.length,
          q.matchingPairs?.length,
        ]),
      }),
    );
    const exam = newExam();
    exam.meta.title = "Test";
    exam.meta.course = "Geography";
    exam.questions = convertGeneration(output, input);
    console.log(JSON.stringify({ language, issues: validateForExport(exam) }));
  } catch (error) {
    console.log(
      JSON.stringify({
        language,
        error: error.message,
        issues: error.issues?.map((i) => ({ path: i.path, code: i.code })),
      }),
    );
    process.exitCode = 1;
  }
}
