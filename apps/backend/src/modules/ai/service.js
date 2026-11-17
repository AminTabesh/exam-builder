import { createHash, randomUUID } from "node:crypto";
import { generationSchema, convertGeneration } from "@exam/shared/ai.js";
import { validateForExport, newExam } from "@exam/shared/exam.js";
import { fail } from "../../middleware/errors.js";
import { generateWithGroq } from "./groq.js";

export function aiService(db, billing, options = {}) {
  const requests = db.collection("ai_requests"),
    results = db.collection("ai_results"),
    counters = db.collection("ai_counters");
  const enabled = () =>
    options.aiGenerate ? true : !!process.env.GROQ_API_KEY;
  const dailyLimit = () => {
    const n = Number(process.env.AI_DAILY_CALL_LIMIT || 100);
    return Number.isSafeInteger(n) && n >= 0 ? n : 100;
  };
  const dayKey = () => new Date().toISOString().slice(0, 10);
  async function allowance(owner, session) {
    const { period, plan } = await billing.current(owner, session);
    const limit = plan.aiGenerations || 0;
    const scope = { owner_id: owner, period_id: period?.id || "" };
    const used = await requests.countDocuments(
      { ...scope, status: "succeeded" },
      { session },
    );
    const reserved = await requests.countDocuments(
      { ...scope, status: "pending", lease_until: { $gt: new Date() } },
      { session },
    );
    return {
      entitled: limit > 0,
      limit,
      used,
      remaining: Math.max(0, limit - used - reserved),
      periodEndsAt: period?.ends_at || null,
      periodId: period?.id,
    };
  }
  async function status(owner) {
    const { periodId, ...usage } = await allowance(owner);
    const counter = await counters.findOne({ _id: dayKey() });
    return {
      ...usage,
      available: enabled() && (counter?.count || 0) < dailyLimit(),
    };
  }
  async function generate(owner, raw) {
    const parsed = generationSchema.safeParse(raw);
    if (!parsed.success)
      throw fail(
        422,
        "موضوع، متن درس، نمره و تعداد سؤال‌ها را بررسی کنید (۱ تا ۱۰ سؤال، حداکثر ۱۲۰۰۰ نویسه متن).",
        "AI_VALIDATION",
      );
    const input = parsed.data;
    const hash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const id = `${owner}:${input.requestKey}`,
      lease = randomUUID();
    let replay;
    await billing.transaction(async (session) => {
      // All reservations and billing activation for an account serialize on this document.
      await db
        .collection("users")
        .updateOne({ id: owner }, { $inc: { ai_version: 1 } }, { session });
      const a = await allowance(owner, session);
      if (!a.entitled)
        throw fail(
          403,
          "تولید سؤال فقط در طرح حرفه‌ای هوشمند فعال است.",
          "AI_PLAN_REQUIRED",
        );
      const old = await requests.findOne({ _id: id }, { session });
      if (old && old.hash !== hash)
        throw fail(
          409,
          "شناسه این درخواست قبلاً برای محتوای دیگری استفاده شده است.",
          "AI_REQUEST_CONFLICT",
        );
      if (old?.status === "succeeded") {
        const result = await results.findOne(
          { _id: id, expires_at: { $gt: new Date() } },
          { session },
        );
        if (!result)
          throw fail(
            410,
            "مهلت بازیابی این دسته گذشته است. یک دسته جدید بسازید.",
            "AI_RESULT_EXPIRED",
          );
        replay = result.questions;
        return;
      }
      if (old?.status === "pending" && old.lease_until > new Date())
        throw fail(
          409,
          "این درخواست هنوز در حال پردازش است. کمی بعد دوباره تلاش کنید.",
          "AI_IN_PROGRESS",
        );
      if (!enabled())
        throw fail(503, "تولید سؤال فعلاً در دسترس نیست.", "AI_UNAVAILABLE");
      if (!a.remaining)
        throw fail(429, "سهمیه تولید سؤال این دوره تمام شده است.", "AI_QUOTA");
      if (
        await requests.findOne(
          {
            owner_id: owner,
            status: "pending",
            lease_until: { $gt: new Date() },
          },
          { session },
        )
      )
        throw fail(409, "یک درخواست دیگر در حال تولید است.", "AI_IN_PROGRESS");
      const user = await db
        .collection("users")
        .findOne({ id: owner }, { session });
      const starts = (user.ai_starts || []).filter(
        (t) => t > new Date(Date.now() - 60000),
      );
      if (starts.length >= 2)
        throw fail(
          429,
          "در هر دقیقه دو درخواست مجاز است. کمی صبر کنید.",
          "AI_RATE_LIMIT",
        );
      await db
        .collection("users")
        .updateOne(
          { id: owner },
          { $set: { ai_starts: [...starts, new Date()] } },
          { session },
        );
      // Shared durable counter prevents concurrent app instances exceeding the daily call cap.
      const day = dayKey();
      const counter = await counters.findOne({ _id: day }, { session });
      if ((counter?.count || 0) >= dailyLimit())
        throw fail(
          429,
          "ظرفیت روزانه سرویس تکمیل شده است. فردا دوباره تلاش کنید.",
          "AI_GLOBAL_LIMIT",
        );
      await counters.updateOne(
        { _id: day },
        { $inc: { count: 1 } },
        { upsert: true, session },
      );
      await requests.updateOne(
        { _id: id },
        {
          $set: {
            owner_id: owner,
            hash,
            period_id: a.periodId,
            status: "pending",
            lease,
            lease_until: new Date(Date.now() + 120000),
            updated_at: new Date(),
          },
        },
        { upsert: true, session },
      );
    });
    if (replay) return { questions: replay, ...(await status(owner)) };
    try {
      let questions;
      for (let attempt = 1; attempt <= 2; attempt++) {
        let validating = false;
        try {
          const output = await (options.aiGenerate || generateWithGroq)(input);
          validating = true;
          questions = convertGeneration(output, input);
          const exam = newExam();
          exam.meta.title = "AI";
          exam.meta.course = "AI";
          exam.questions = questions;
          const issues = validateForExport(exam);
          if (issues.length) throw new Error("Invalid editor content");
          break;
        } catch (cause) {
          // Provider availability and rate limits should never trigger retries.
          if (!validating && cause.code !== "AI_INVALID_OUTPUT") throw cause;
          console.warn(JSON.stringify({
            event: "ai_output_rejected",
            requestId: input.requestKey,
            attempt,
            reason: cause.issues ? "schema_validation" : cause.code || cause.message,
            fields: cause.issues?.map(issue => ({ path: issue.path, code: issue.code })),
          }));
          if (attempt === 2) throw fail(
            502,
            "سؤال‌های تولیدشده معتبر نبودند یا متن درس برای این درخواست کافی نیست. متن یا تنظیمات را تغییر دهید. سهمیه شما کم نشد.",
            "AI_INVALID_OUTPUT",
          );
        }
      }
      await billing.transaction(async (session) => {
        const updated = await requests.updateOne(
          {
            _id: id,
            lease,
            status: "pending",
            lease_until: { $gt: new Date() },
          },
          { $set: { status: "succeeded", updated_at: new Date() } },
          { session },
        );
        if (!updated.modifiedCount)
          throw fail(
            409,
            "مهلت این درخواست گذشته است. دوباره تلاش کنید.",
            "AI_REQUEST_EXPIRED",
          );
        await results.updateOne(
          { _id: id },
          { $set: { questions, expires_at: new Date(Date.now() + 86400000) } },
          { session, upsert: true },
        );
      });
      return { questions, ...(await status(owner)) };
    } catch (error) {
      await requests.updateOne(
        { _id: id, lease, status: "pending" },
        { $set: { status: "failed", updated_at: new Date() } },
      );
      console.warn(
        JSON.stringify({
          event: "ai_generation_failed",
          requestId: input.requestKey,
          code: error.code || "AI_UNAVAILABLE",
        }),
      );
      if (error.status) throw error;
      throw fail(
        503,
        "تولید سؤال انجام نشد. دوباره تلاش کنید.",
        "AI_UNAVAILABLE",
      );
    }
  }
  return { status, generate };
}
