import { randomInt, randomUUID, createHmac } from "node:crypto";
import { fail } from "../../middleware/errors.js";
export function normalizeIdentifier(value) {
  if (typeof value !== "string" || value.length > 254)
    throw fail(
      422,
      "ایمیل یا شماره همراه معتبر وارد کنید.",
      "INVALID_IDENTIFIER",
    );
  const input = value
    .trim()
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input))
    return { field: "email", value: input.toLowerCase() };
  const phone = input
    .replace(/[\s()-]/g, "")
    .replace(/^0098/, "+98")
    .replace(/^09/, "+989");
  if (/^\+989\d{9}$/.test(phone)) return { field: "phone", value: phone };
  throw fail(
    422,
    "ایمیل یا شماره همراه ایرانی معتبر وارد کنید.",
    "INVALID_IDENTIFIER",
  );
}
export const userView = (u) => ({
  id: u.id,
  email: u.email || null,
  phone: u.phone || null,
  name: u.name,
  verified: true,
  role: u.role || "user",
  status: u.status || "active",
  profile: u.profile || {},
});
export function authService(db, billing, { deliver, secret }) {
  const challenges = db.collection("otp_challenges"),
    users = db.collection("users");
  const hash = (id, code) =>
    createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
  async function request(identifier, owner, sessionId) {
    const identity = normalizeIdentifier(identifier),
      now = new Date();
    const rateKey = `${identity.value}:${Math.floor(Date.now() / 3600000)}`;
    const rate = await db.collection("otp_rates").findOneAndUpdate(
      { _id: rateKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { expires_at: new Date(Date.now() + 7200000) },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (rate.count > 10)
      throw fail(
        429,
        "تعداد درخواست‌ها زیاد است؛ یک ساعت دیگر تلاش کنید.",
        "OTP_RATE_LIMIT",
      );
    const id = randomUUID(),
      code = String(randomInt(0, 1000000)).padStart(6, "0");
    const record = {
      id,
      field: identity.field,
      digest: hash(id, code),
      owner_id: owner || null,
      session_id: sessionId,
      attempts: 0,
      expires_at: new Date(Date.now() + 300000),
      next_at: new Date(Date.now() + 60000),
      consumed: false,
    };
    try {
      await challenges.updateOne(
        { _id: identity.value, next_at: { $lte: now } },
        { $set: record },
        { upsert: true },
      );
    } catch (e) {
      if (e.code === 11000)
        throw fail(
          429,
          "برای ارسال دوباره کد، ۶۰ ثانیه صبر کنید.",
          "OTP_COOLDOWN",
        );
      throw e;
    }
    try {
      await deliver(identity, code);
    } catch (e) {
      await challenges.deleteOne({ id });
      throw fail(
        503,
        "ارسال کد انجام نشد. دوباره تلاش کنید.",
        "OTP_DELIVERY_FAILED",
      );
    }
    return { challengeId: id, expiresIn: 300, retryAfter: 60 };
  }
  async function verify(id, code, owner, sessionId, name) {
    if (
      typeof id !== "string" ||
      typeof code !== "string" ||
      !/^[0-9۰-۹٠-٩]{6}$/.test(code)
    )
      throw fail(422, "کد شش‌رقمی را وارد کنید.", "INVALID_OTP");
    code = code
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const scope = {
      id,
      session_id: sessionId,
      owner_id: owner || null,
      consumed: false,
      expires_at: { $gt: new Date() },
      attempts: { $lt: 5 },
    };
    const attempt = await challenges.findOneAndUpdate(
      scope,
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    if (!attempt || attempt.digest !== hash(id, code))
      throw fail(400, "کد اشتباه، منقضی یا مصرف‌شده است.", "OTP_INVALID");
    return billing.transaction(async (session) => {
      const challenge = await challenges.findOneAndUpdate(
        { ...scope, attempts: { $lte: 5 }, digest: hash(id, code) },
        { $set: { consumed: true } },
        { session, returnDocument: "after" },
      );
      if (!challenge) throw fail(400, "کد قبلاً مصرف شده است.", "OTP_INVALID");
      let user = await users.findOne(
        { [challenge.field]: challenge._id },
        { session },
      );
      if (owner) {
        if (user && user.id !== owner)
          throw fail(
            409,
            "این شماره یا ایمیل متعلق به حساب دیگری است.",
            "IDENTITY_IN_USE",
          );
        const existing = await users.findOne({ id: owner }, { session });
        if (
          existing[challenge.field] &&
          existing[challenge.field] !== challenge._id
        )
          throw fail(
            409,
            "این روش ورود قبلاً به حساب متصل شده است.",
            "IDENTITY_ALREADY_LINKED",
          );
        await users.updateOne(
          { id: owner },
          { $set: { [challenge.field]: challenge._id } },
          { session },
        );
        return users.findOne({ id: owner }, { session });
      }
      if (!user) {
        user = {
          id: randomUUID(),
          [challenge.field]: challenge._id,
          name:
            typeof name === "string" && name.trim()
              ? name.trim().slice(0, 100)
              : "",
          profile: {},
          role: "user",
          status: "active",
          session_version: 1,
          lifetime_created: 0,
          created_at: new Date(),
        };
        await users.insertOne({ ...user }, { session });
      }
      if (["suspended", "deleting"].includes(user.status))
        throw fail(403, "حساب تعلیق شده است.", "ACCOUNT_SUSPENDED");
      return user;
    });
  }
  return { request, verify };
}
