import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import nodemailer from "nodemailer";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { parseExam, assetIds, validateForExport } from "../shared/exam.js";
import { generatePdf } from "./pdf.js";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createApp(
  db,
  { test = false, mailTransport, sessionStore, mongoClient } = {},
) {
  const app = express(),
    prod = process.env.NODE_ENV === "production",
    assetRoot = path.resolve(process.env.ASSET_DIR || "data/assets");
  if (
    prod &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  )
    throw new Error("SESSION_SECRET is required");
  if (prod && !process.env.APP_URL?.startsWith("https://"))
    throw new Error("HTTPS APP_URL is required in production");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "blob:", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'"],
          "frame-src": ["'self'", "blob:"],
          "object-src": ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: test ? 10000 : 180,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.use(
    session({
      store:
        sessionStore ||
        MongoStore.create({
          client: mongoClient,
          dbName: db.databaseName,
          collectionName: "sessions",
        }),
      secret: process.env.SESSION_SECRET || "local-development-only-change-me",
      name: "exam.sid",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: prod,
        sameSite: "lax",
        maxAge: 7 * 86400000,
      },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== (process.env.APP_URL || "http://localhost:5173")
    )
      return next(fail(403, "مبدأ درخواست معتبر نیست."));
    next();
  });
  const users = db.collection("users"),
    exams = db.collection("exams"),
    assets = db.collection("assets");
  const publicRecord = { projection: { _id: 0 } };
  const createExam = async (owner_id, document) => {
    const row = {
      id: randomUUID(),
      owner_id,
      document,
      revision: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await exams.insertOne({ ...row });
    return row;
  };
  const userView = (u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    verified: u.verified,
    profile: u.profile,
  });
  const auth = async (req, res, next) => {
    try {
      if (!req.session.userId) throw fail(401, "ابتدا وارد حساب شوید.");
      const user = await users.findOne({ id: req.session.userId });
      if (!user || req.session.version !== user.session_version)
        throw fail(401, "نشست شما پایان یافته است.");
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };
  const verified = (req, res, next) =>
    req.user.verified
      ? next()
      : next(fail(403, "ابتدا نشانی ایمیل خود را تأیید کنید."));
  const owned = async (id, owner) => {
    const exam = await exams.findOne({ id, owner_id: owner }, publicRecord);
    if (!exam) throw fail(404, "آزمون پیدا نشد.");
    return exam;
  };
  const checkAssets = async (document, owner) => {
    const map = new Map();
    for (const id of assetIds(document)) {
      const asset = await assets.findOne({ id, owner_id: owner });
      if (!asset) throw fail(422, "تصویر متعلق به این حساب نیست.");
      map.set("/api/assets/" + id, path.join(assetRoot, asset.filename));
    }
    return map;
  };
  const transport =
    mailTransport ||
    (process.env.SMTP_HOST
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        })
      : null);
  const sendToken = async (user, kind) => {
    if (!transport)
      throw fail(
        503,
        "ارسال ایمیل هنوز پیکربندی نشده است. با مدیر سامانه تماس بگیرید.",
      );
    const token = randomBytes(32).toString("hex");
    // Embed token digests in the account so consuming a token and changing
    // credentials/session version happen in one atomic document update.
    await users.updateOne(
      { id: user.id },
      { $pull: { tokens: { expires_at: { $lte: new Date() } } } },
    );
    await users.updateOne(
      { id: user.id },
      {
        $push: {
          tokens: {
            $each: [
              {
                digest: digest(token),
                kind,
                expires_at: new Date(
                  Date.now() + (kind === "reset" ? 3600000 : 86400000),
                ),
              },
            ],
            $slice: -20,
          },
        },
      },
    );
    const url = `${process.env.APP_URL || "http://localhost:5173"}/account?mode=${kind}&token=${token}`;
    await transport.sendMail({
      from: process.env.MAIL_FROM || "Exam <exam@localhost>",
      to: user.email,
      subject:
        kind === "reset" ? "بازیابی رمز آزمون‌برگ" : "تأیید ایمیل آزمون‌برگ",
      text: `برای ادامه این پیوند را باز کنید:\n${url}\nاگر درخواست از شما نیست، این پیام را نادیده بگیرید.`,
    });
  };
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: test ? 10000 : 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "تعداد تلاش‌ها زیاد است. ۱۵ دقیقه دیگر دوباره تلاش کنید.",
    },
  });
  app.get("/api/health", async (req, res) => {
    try {
      await db.command({ ping: 1 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  app.get("/api/auth/me", auth, (req, res) => res.json(userView(req.user)));
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const { email, password, name } = req.body;
    if (
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      email.length > 254 ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 72
    )
      throw fail(422, "نام، ایمیل معتبر و رمز بین ۱۰ تا ۷۲ نویسه وارد کنید.");
    if (!transport)
      throw fail(503, "برای ثبت‌نام، تنظیمات ارسال ایمیل سرور باید تکمیل شود.");
    const user = {
      id: randomUUID(),
      email: email.toLowerCase().trim(),
      name: name.trim(),
    };
    try {
      await users.insertOne({
        ...user,
        password_hash: await bcrypt.hash(digest(password), 12),
        verified: false,
        session_version: 1,
        profile: {},
        tokens: [],
        created_at: new Date(),
      });
    } catch (e) {
      if (e.code === 11000)
        throw fail(
          409,
          "این ایمیل قبلاً ثبت شده است. وارد شوید یا رمز را بازیابی کنید.",
        );
      throw e;
    }
    await sendToken(user, "verify");
    res.status(201).json({ message: "پیوند تأیید به ایمیل شما ارسال شد." });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const { email, password } = req.body;
    const user = await users.findOne({
      email: String(email).toLowerCase().trim(),
    });
    if (
      !user ||
      typeof password !== "string" ||
      !(await bcrypt.compare(digest(password), user.password_hash))
    )
      throw fail(401, "ایمیل یا رمز عبور درست نیست.");
    await new Promise((resolve, reject) =>
      req.session.regenerate((e) => (e ? reject(e) : resolve())),
    );
    req.session.userId = user.id;
    req.session.version = user.session_version;
    res.json(userView(user));
  });
  app.post("/api/auth/logout", (req, res, next) =>
    req.session.destroy((e) => {
      if (e) return next(e);
      res.clearCookie("exam.sid");
      res.json({ ok: true });
    }),
  );
  app.post("/api/auth/recover", authLimit, async (req, res) => {
    const user = await users.findOne({
      email: String(req.body.email).toLowerCase().trim(),
    });
    if (user) await sendToken(user, "reset");
    res.json({
      message:
        "اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود.",
    });
  });
  app.post("/api/auth/resend", authLimit, auth, async (req, res) => {
    if (!req.user.verified) await sendToken(req.user, "verify");
    res.json({ message: "پیوند تأیید ارسال شد." });
  });
  app.post("/api/auth/token", authLimit, async (req, res) => {
    const { token, kind, password } = req.body;
    if (
      !["verify", "reset"].includes(kind) ||
      typeof token !== "string" ||
      token.length !== 64
    )
      throw fail(422, "پیوند معتبر نیست.");
    if (
      kind === "reset" &&
      (typeof password !== "string" ||
        password.length < 10 ||
        password.length > 72)
    )
      throw fail(422, "رمز باید بین ۱۰ تا ۷۲ نویسه باشد.");
    const passwordHash =
      kind === "reset" ? await bcrypt.hash(digest(password), 12) : null;
    const match = {
      digest: digest(token),
      kind,
      expires_at: { $gt: new Date() },
    };
    const update =
      kind === "verify"
        ? {
            $set: { verified: true },
            $pull: { tokens: { digest: digest(token), kind } },
          }
        : {
            $set: { password_hash: passwordHash },
            $inc: { session_version: 1 },
            $pull: { tokens: { kind: "reset" } },
          };
    const user = await users.findOneAndUpdate(
      { tokens: { $elemMatch: match } },
      update,
      { returnDocument: "after", includeResultMetadata: false },
    );
    if (!user) throw fail(400, "پیوند منقضی یا قبلاً استفاده شده است.");
    res.json({
      message:
        kind === "verify"
          ? "ایمیل تأیید شد. اکنون وارد شوید."
          : "رمز تغییر کرد. اکنون وارد شوید.",
    });
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
  app.get("/api/exams", auth, async (req, res) => {
    res.json(
      await exams
        .find({ owner_id: req.user.id }, publicRecord)
        .sort({ updated_at: -1 })
        .toArray(),
    );
  });
  app.post("/api/exams", auth, verified, async (req, res) => {
    const document = parseExam(req.body.document);
    await checkAssets(document, req.user.id);
    res.status(201).json(await createExam(req.user.id, document));
  });
  app.get("/api/exams/:id", auth, async (req, res) =>
    res.json(await owned(req.params.id, req.user.id)),
  );
  app.put("/api/exams/:id", auth, verified, async (req, res) => {
    const document = parseExam(req.body.document);
    await checkAssets(document, req.user.id);
    await owned(req.params.id, req.user.id);
    if (!Number.isSafeInteger(req.body.revision) || req.body.revision < 1)
      throw fail(409, "نسخه آزمون معتبر نیست. آخرین نسخه را بارگذاری کنید.");
    const updated = await exams.findOneAndUpdate(
      { id: req.params.id, owner_id: req.user.id, revision: req.body.revision },
      { $set: { document, updated_at: new Date() }, $inc: { revision: 1 } },
      {
        ...publicRecord,
        returnDocument: "after",
        includeResultMetadata: false,
      },
    );
    if (!updated)
      throw fail(
        409,
        "این آزمون در پنجره دیگری تغییر کرده است. نسخه جدید را باز کنید یا از کار خود یک کپی بسازید.",
      );
    res.json(updated);
  });
  app.delete("/api/exams/:id", auth, async (req, res) => {
    await owned(req.params.id, req.user.id);
    await exams.deleteOne({ id: req.params.id, owner_id: req.user.id });
    res.json({ ok: true });
  });
  app.post("/api/exams/:id/duplicate", auth, verified, async (req, res) => {
    const source = await owned(req.params.id, req.user.id);
    source.document.meta.title += " (کپی)";
    res.status(201).json(await createExam(req.user.id, source.document));
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/assets",
    auth,
    verified,
    upload.single("image"),
    async (req, res) => {
      if (!req.file) throw fail(422, "یک تصویر انتخاب کنید.");
      const id = randomUUID(),
        filename = id + ".webp";
      await mkdir(assetRoot, { recursive: true });
      try {
        const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
        const metadata = await image.metadata();
        if (!["png", "jpeg", "webp"].includes(metadata.format))
          throw new Error("Unsupported image");
        await image
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toFile(path.join(assetRoot, filename));
      } catch {
        throw fail(
          422,
          "تصویر معتبر PNG، JPEG یا WebP با حداکثر ۵ مگابایت انتخاب کنید.",
        );
      }
      try {
        await assets.insertOne({
          id,
          owner_id: req.user.id,
          filename,
          created_at: new Date(),
        });
      } catch (e) {
        await unlink(path.join(assetRoot, filename));
        throw e;
      }
      res.status(201).json({ src: "/api/assets/" + id });
    },
  );
  app.get("/api/assets/:id", auth, async (req, res) => {
    const asset = await assets.findOne({
      id: req.params.id,
      owner_id: req.user.id,
    });
    if (!asset) throw fail(404, "تصویر پیدا نشد.");
    res.type("webp").sendFile(path.join(assetRoot, asset.filename));
  });
  app.post("/api/exams/:id/pdf", auth, verified, async (req, res) => {
    const exam = await owned(req.params.id, req.user.id);
    if (req.body.revision !== exam.revision)
      throw fail(409, "ابتدا آخرین تغییرات را ذخیره کنید.");
    if (!["student", "answer-key"].includes(req.body.kind))
      throw fail(422, "نوع خروجی معتبر نیست.");
    const issues = validateForExport(exam.document);
    if (issues.length) throw fail(422, issues.join("\n"));
    const assets = await checkAssets(exam.document, req.user.id);
    const pdf = await generatePdf(exam.document, req.body.kind, assets);
    res
      .type("pdf")
      .set("Content-Disposition", 'attachment; filename="exam.pdf"')
      .send(pdf);
  });
  // Local demo documents never enter the account database; exports still use the same validated print path.
  app.post(
    "/api/demo/pdf",
    rateLimit({ windowMs: 60000, limit: test ? 10000 : 6 }),
    async (req, res) => {
      const document = parseExam(req.body.document);
      if (assetIds(document).length)
        throw fail(422, "برای استفاده از تصویر وارد حساب شوید.");
      if (!["student", "answer-key"].includes(req.body.kind))
        throw fail(422, "نوع خروجی معتبر نیست.");
      const issues = validateForExport(document);
      if (issues.length) throw fail(422, issues.join("\n"));
      res.type("pdf").send(await generatePdf(document, req.body.kind));
    },
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "مسیر پیدا نشد." }),
  );
  app.use(express.static("dist"));
  app.get("/{*splat}", (req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((error, req, res, next) => {
    const status =
      error.name === "ZodError"
        ? 422
        : error.code === "LIMIT_FILE_SIZE"
          ? 413
          : error.status || 500;
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "request_error",
          code: error.code || error.name,
        }),
      );
    res.status(status).json({
      error:
        error.name === "ZodError"
          ? "ساختار آزمون معتبر نیست. مقادیر واردشده را بررسی کنید."
          : status === 500
            ? "ارتباط با سرور برقرار نشد. دوباره تلاش کنید."
            : error.message,
    });
  });
  return app;
}
