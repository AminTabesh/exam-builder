import { adminRoutes } from "./modules/admin/routes.js";
import { aiRoutes } from "./modules/ai/routes.js";
import { requireAuth } from "./modules/auth/middleware.js";
import { fontRoutes } from "./modules/fonts/routes.js";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import "./config/env.js";
import { ROOT } from "./config/env.js";
import { fail } from "./middleware/errors.js";
import { billingService } from "./modules/billing/service.js";
import { billingRoutes } from "./modules/billing/routes.js";
import { bazaarRoutes } from "./modules/billing/bazaar.js";
import { authRoutes } from "./modules/auth/routes.js";
import { mobileSession } from "./modules/auth/mobile.js";
import multer from "multer";
import path from "node:path";
import { assetService } from "./modules/assets/service.js";
import { assetRoutes } from "./modules/assets/routes.js";
import { examRoutes } from "./modules/exams/routes.js";
export function createApp(db, options = {}) {
  const { test = false, sessionStore, mongoClient } = options;
  const billing = billingService(db, mongoClient);
  const app = express(),
    prod = process.env.NODE_ENV === "production",
    assetRoot = path.resolve(ROOT, process.env.ASSET_DIR || "data/assets");
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
  app.use(express.json({ limit: "5mb" }));
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
  app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const nativeOrigin = [
      "https://localhost",
      "capacitor://localhost",
    ].includes(req.headers.origin);
    if (nativeOrigin) {
      res.set("Access-Control-Allow-Origin", req.headers.origin);
      res.vary("Origin");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      if (req.method === "OPTIONS") return res.sendStatus(204);
    }
    let bearer = false;
    if (req.get("authorization")) {
      try {
        bearer = !!(await mobileSession(db, req));
      } catch (error) {
        return next(error);
      }
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !bearer &&
      !(
        nativeOrigin &&
        ["/mobile/auth/challenge", "/mobile/auth/verify"].includes(req.path)
      ) &&
      req.headers.origin &&
      req.headers.origin !== (process.env.APP_URL || "http://localhost:5173")
    )
      return next(fail(403, "مبدأ درخواست معتبر نیست.", "INVALID_ORIGIN"));
    next();
  });
  const { checkAssets } = assetService(db, assetRoot);
  const auth = requireAuth(db);
  app.get("/api/health", async (req, res) => {
    try {
      await db.command({ ping: 1 });
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  authRoutes(app, auth, db, billing, options);
  adminRoutes(app, auth, db, billing, assetRoot);
  billingRoutes(app, auth, billing);
  bazaarRoutes(app, auth, db, billing, options);
  aiRoutes(app, auth, db, billing, options);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  fontRoutes(app, auth, upload, db, billing, path.join(assetRoot, "fonts"));
  examRoutes(app, auth, db, billing, checkAssets);
  assetRoutes(app, auth, db, upload, assetRoot, billing);
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "مسیر پیدا نشد.", code: "NOT_FOUND" }),
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
      code:
        typeof error.code === "string"
          ? error.code
          : status === 422
            ? "VALIDATION_ERROR"
            : "REQUEST_FAILED",
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
