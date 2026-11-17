import { randomBytes, createHash } from "node:crypto";
import { fail } from "../../middleware/errors.js";
import { userView } from "./service.js";

export const tokenDigest = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function mobileSession(db, req) {
  const header = req.get("authorization");
  if (!header) return null;
  if (!/^Bearer [a-f0-9]{64}$/.test(header))
    throw fail(401, "نشست معتبر نیست.", "SESSION_EXPIRED");
  const row = await db.collection("mobile_sessions").findOne({
    _id: tokenDigest(header.slice(7)),
    expires_at: { $gt: new Date() },
  });
  if (!row) throw fail(401, "دوباره وارد حساب شوید.", "SESSION_EXPIRED");
  const user = await db.collection("users").findOne({ id: row.owner_id });
  if (!user || user.session_version !== row.version)
    throw fail(401, "دوباره وارد حساب شوید.", "SESSION_EXPIRED");
  if (["suspended", "deleting"].includes(user.status))
    throw fail(403, "حساب تعلیق شده است.", "ACCOUNT_SUSPENDED");
  return { row, user };
}

export function mobileAuthRoutes(app, db, service, auth, limit) {
  const random = () => randomBytes(32).toString("hex");
  app.post("/api/mobile/auth/challenge", limit, async (req, res) => {
    const secret = random();
    const result = await service.request(
      req.body.identifier,
      null,
      tokenDigest(secret),
    );
    if (req.body.privacyConsent === "2026-11-15")
      await db
        .collection("otp_challenges")
        .updateOne(
          { id: result.challengeId },
          { $set: { privacy_consent: "2026-11-15" } },
        );
    if (req.body.admin === true)
      await db
        .collection("otp_challenges")
        .updateOne(
          { id: result.challengeId },
          { $set: { admin_intent: true } },
        );
    res.json({ ...result, challengeSecret: secret });
  });
  app.post("/api/mobile/auth/verify", limit, async (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.body.challengeSecret || ""))
      throw fail(422, "درخواست ورود معتبر نیست.", "INVALID_CHALLENGE");
    const user = await service.verify(
      req.body.challengeId,
      req.body.code,
      null,
      tokenDigest(req.body.challengeSecret),
      req.body.name,
    );
    const challenge = await db
      .collection("otp_challenges")
      .findOne({ id: req.body.challengeId });
    if (challenge?.privacy_consent)
      await db.collection("users").updateOne(
        { id: user.id },
        {
          $set: {
            privacy_consent: {
              version: challenge.privacy_consent,
              accepted_at: new Date(),
            },
          },
        },
      );
    const token = random(),
      expiresAt = new Date(Date.now() + 7 * 86400000);
    await db.collection("mobile_sessions").insertOne({
      _id: tokenDigest(token),
      owner_id: user.id,
      version: user.session_version,
      ...(challenge?.admin_intent ? { adminLogin: Date.now() } : {}),
      expires_at: expiresAt,
      created_at: new Date(),
    });
    res.json({ user: userView(user), token, expiresAt });
  });
  app.post("/api/mobile/auth/logout", auth, async (req, res) => {
    if (req.mobileSession)
      await db
        .collection("mobile_sessions")
        .deleteOne({ _id: req.mobileSession._id });
    res.json({ ok: true });
  });
}
