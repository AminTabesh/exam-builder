import { fail } from "../../middleware/errors.js";
import nodemailer from "nodemailer";
import { rateLimit } from "express-rate-limit";
import { authService, userView } from "./service.js";
import { mobileAuthRoutes } from "./mobile.js";
export function authRoutes(app, auth, db, billing, options) {
  const prod = process.env.NODE_ENV === "production";
  if (prod && (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32))
    throw new Error("OTP_SECRET of at least 32 characters is required");
  const mode = process.env.OTP_DELIVERY || (prod ? "providers" : "console");
  if (prod && mode === "console")
    throw new Error("Console OTP delivery is development-only");
  const transport =
    options.mailTransport ||
    (process.env.SMTP_HOST &&
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      }));
  const localMail = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });
  const service = authService(db, billing, {
    secret:
      process.env.OTP_SECRET ||
      process.env.SESSION_SECRET ||
      "development-otp-secret-change-me",
    deliver: async (identity, code) => {
      const message = {
        from: process.env.MAIL_FROM || "Exam <exam@localhost>",
        to: identity.value,
        subject: "کد ورود آزمون‌برگ",
        text: `کد ورود شما: ${code}\nاعتبار: ۵ دقیقه. این کد را در اختیار دیگران نگذارید.`,
      };
      if (options.deliverOtp) return options.deliverOtp(identity, code);
      if (identity.field === "email") {
        if (mode === "console" && !options.mailTransport)
          await localMail.sendMail(message);
        else if (transport) await transport.sendMail(message);
        else throw new Error("SMTP is not configured");
      } else if (mode !== "console") {
        if (!options.smsProvider)
          throw new Error("SMS provider is not configured");
        await options.smsProvider.sendOtp(identity.value, code);
      }
      if (mode === "console" && !options.test)
        console.info(`[DEV OTP] ${identity.value}: ${code} (5 minutes)`);
    },
  });
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: options.test ? 10000 : 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "تعداد تلاش‌ها زیاد است؛ کمی بعد تلاش کنید.",
      code: "AUTH_RATE_LIMIT",
    },
  });
  const phoneAvailable =
    mode === "console" || !!options.smsProvider || !!options.deliverOtp;
  app.get("/api/auth/methods", (req, res) =>
    res.json({
      phone: phoneAvailable,
      email: mode === "console" || !!transport || !!options.deliverOtp,
    }),
  );
  mobileAuthRoutes(app, db, service, auth, limit);
  app.get("/api/auth/me", auth, (req, res) => res.json(userView(req.user)));
  app.post("/api/auth/otp/request", limit, async (req, res) => {
    req.session.privacyConsent =
      req.body.privacyConsent === "2026-11-15" ? "2026-11-15" : null;
    req.session.otpStarted = true;
    req.session.adminIntent = req.body.admin === true;
    res.json(await service.request(req.body.identifier, null, req.sessionID));
  });
  app.post("/api/auth/otp/verify", limit, async (req, res) => {
    const user = await service.verify(
      req.body.challengeId,
      req.body.code,
      null,
      req.sessionID,
      req.body.name,
    );
    if (req.session.privacyConsent)
      await db.collection("users").updateOne(
        { id: user.id },
        {
          $set: {
            privacy_consent: {
              version: req.session.privacyConsent,
              accepted_at: new Date(),
            },
          },
        },
      );
    const adminIntent = req.session.adminIntent;
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    if (adminIntent) req.session.adminLogin = Date.now();
    req.session.userId = user.id;
    req.session.version = user.session_version;
    res.json(userView(user));
  });
  app.post("/api/auth/identities/request", limit, auth, async (req, res) =>
    res.json(
      await service.request(
        req.body.identifier,
        req.user.id,
        req.mobileSession?._id || req.sessionID,
      ),
    ),
  );
  app.post("/api/auth/identities/verify", limit, auth, async (req, res) =>
    res.json(
      userView(
        await service.verify(
          req.body.challengeId,
          req.body.code,
          req.user.id,
          req.mobileSession?._id || req.sessionID,
        ),
      ),
    ),
  );
  app.post("/api/auth/logout", (req, res, next) =>
    req.session.destroy((e) => {
      if (e) return next(e);
      res.clearCookie("exam.sid");
      res.json({ ok: true });
    }),
  );
  const users = db.collection("users");
  app.put("/api/auth/name", auth, async (req, res) => {
    const name = req.body?.name;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100)
      throw fail(422, "نام مدرس را با حداکثر ۱۰۰ نویسه وارد کنید.");
    await users.updateOne({ id: req.user.id }, { $set: { name: name.trim() } });
    res.json({ name: name.trim() });
  });
  app.put("/api/auth/profile", auth, async (req, res) => {
    const profile = req.body;
    if (
      !profile ||
      Object.keys(profile).some(
        (k) =>
          ![
            "institution",
            "instructor",
            "faculty",
            "department",
            "year",
          ].includes(k),
      ) ||
      Object.values(profile).some(
        (v) => typeof v !== "string" || v.length > 200,
      )
    )
      throw fail(422, "مشخصات مؤسسه معتبر نیست.");
    await users.updateOne({ id: req.user.id }, { $set: { profile } });
    res.json(profile);
  });
}
