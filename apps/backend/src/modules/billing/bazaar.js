import {
  randomUUID,
  createHash,
  createPublicKey,
  verify,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { plans, addMonth } from "./catalog.js";
import { fail } from "../../middleware/errors.js";
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function bazaarProducts() {
  return Object.fromEntries(
    plans
      .filter((p) => p.price)
      .map((p) => [
        p.id,
        process.env[`BAZAAR_SKU_${p.id.toUpperCase().replaceAll("-", "_")}`] ||
          "",
      ]),
  );
}
export function bazaarConfigured() {
  return !!(
    process.env.BAZAAR_API_TOKEN &&
    process.env.BAZAAR_RSA_PUBLIC_KEY &&
    Object.values(bazaarProducts()).every(Boolean)
  );
}
export function bazaarService(
  db,
  billing,
  { bazaarProvider, bazaarPublicKey } = {},
) {
  const subscriptions = db.collection("bazaar_subscriptions"),
    intents = db.collection("bazaar_intents");
  const packageName = process.env.BAZAAR_PACKAGE_NAME || "ir.azmounbarg.app";
  const encryptionKey = createHash("sha256")
    .update(
      process.env.BAZAAR_TOKEN_SECRET ||
        process.env.SESSION_SECRET ||
        "development-only",
    )
    .digest();
  function seal(token) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString("base64"))
      .join(".");
  }
  function unseal(value) {
    const [iv, tag, data] = value
      .split(".")
      .map((v) => Buffer.from(v, "base64"));
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString(
      "utf8",
    );
  }
  async function provider(product, token, cancel = false) {
    if (bazaarProvider)
      return bazaarProvider({ productId: product, token, cancel, packageName });
    if (!bazaarConfigured())
      throw fail(503, "پرداخت بازار هنوز آماده نیست.", "BAZAAR_UNAVAILABLE");
    const path = [
      "applications",
      packageName,
      "subscriptions",
      "1",
      "purchases",
      token,
    ]
      .map(encodeURIComponent)
      .join("/");
    let response;
    try {
      response = await fetch(
        `https://pardakht.cafebazaar.ir/devapi/v2/api/${path}${cancel ? "/cancel/" : ""}`,
        {
          method: cancel ? "POST" : "GET",
          signal: AbortSignal.timeout(15000),
          headers: {
            "CAFEBAZAAR-PISHKHAN-API-SECRET": process.env.BAZAAR_API_TOKEN,
          },
        },
      );
    } catch {
      throw fail(
        503,
        "ارتباط با بازار برقرار نشد؛ خرید شما با بازیابی دوباره بررسی می‌شود.",
        "BAZAAR_UNAVAILABLE",
      );
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 404 && data?.error === "not_found")
        throw fail(404, "اشتراک در بازار پیدا نشد.", "BAZAAR_NOT_FOUND");
      throw fail(
        503,
        "بررسی اشتراک بازار انجام نشد. دوباره تلاش کنید.",
        "BAZAAR_UNAVAILABLE",
      );
    }
    return data;
  }
  async function intent(owner, planId) {
    const productId = bazaarProducts()[planId];
    if (!productId || (!bazaarProvider && !bazaarConfigured()))
      throw fail(
        503,
        "این طرح در بازار آماده خرید نیست.",
        "BAZAAR_UNAVAILABLE",
      );
    const { period } = await billing.purchased(owner);
    if (period)
      throw fail(
        409,
        "تا پایان اشتراک فعلی خرید تازه انجام ندهید. اشتراک بازار به‌صورت خودکار تمدید می‌شود.",
        "SUBSCRIPTION_ACTIVE",
      );
    const row = {
      _id: randomUUID(),
      owner_id: owner,
      plan_id: planId,
      product_id: productId,
      created_at: new Date(),
    };
    await intents.insertOne(row);
    return { productId, payload: row._id };
  }
  function signedReceipt(receipt) {
    if (
      !receipt ||
      typeof receipt.originalJson !== "string" ||
      receipt.originalJson.length > 16000 ||
      typeof receipt.signature !== "string" ||
      receipt.signature.length > 4000
    )
      throw fail(422, "رسید خرید معتبر نیست.", "INVALID_RECEIPT");
    const configured = bazaarPublicKey || process.env.BAZAAR_RSA_PUBLIC_KEY;
    if (!configured)
      throw fail(503, "کلید تأیید بازار تنظیم نشده است.", "BAZAAR_UNAVAILABLE");
    const key = configured.includes("BEGIN PUBLIC KEY")
      ? configured
      : `-----BEGIN PUBLIC KEY-----\n${configured.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
    let data;
    try {
      if (
        !verify(
          "RSA-SHA1",
          Buffer.from(receipt.originalJson),
          createPublicKey(key),
          Buffer.from(receipt.signature, "base64"),
        )
      )
        throw new Error();
      data = JSON.parse(receipt.originalJson);
      if (
        data.packageName !== packageName ||
        data.productId !== receipt.productId ||
        data.purchaseToken !== receipt.purchaseToken ||
        data.purchaseState !== 0 ||
        typeof data.developerPayload !== "string"
      )
        throw new Error();
    } catch {
      throw fail(422, "امضای رسید خرید معتبر نیست.", "INVALID_RECEIPT");
    }
    if (!/^[A-Za-z0-9._:-]{1,4096}$/.test(data.purchaseToken))
      throw fail(422, "توکن خرید معتبر نیست.", "INVALID_RECEIPT");
    return data;
  }
  async function apply(owner, record, state) {
    const start = new Date(Number(state?.initiationTimestampMsec)),
      end = new Date(Number(state?.validUntilTimestampMsec));
    if (
      state?.kind !== "androidpublisher#subscriptionPurchase" ||
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      +end <= +start ||
      typeof state.autoRenewing !== "boolean"
    )
      throw fail(503, "پاسخ بازار قابل تأیید نیست.", "BAZAAR_INVALID_RESPONSE");
    const now = new Date();
    // Provider expiry identifies a paid cycle. Repeated polls never create a fresh allowance.
    let cycle = Math.max(
      0,
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        start.getUTCMonth() -
        1,
    );
    while (+addMonth(start, cycle + 1) < +end - 60000) cycle++;
    while (cycle > 0 && +addMonth(start, cycle) >= +end) cycle--;
    const cycleStart = addMonth(start, cycle);
    const periodId = `bazaar-${record._id}-${cycle}`;
    await billing.transaction(async (session) => {
      if (
        !(await db
          .collection("users")
          .findOne({ id: owner, status: { $ne: "deleting" } }, { session }))
      )
        throw fail(409, "حساب در دسترس نیست.", "ACCOUNT_UNAVAILABLE");
      await db
        .collection("users")
        .updateOne(
          { id: owner },
          { $inc: { billing_version: 1 } },
          { session },
        );
      const existing = await subscriptions.findOne(
        { _id: record._id },
        { session },
      );
      if (existing && existing.owner_id !== owner)
        throw fail(
          409,
          "این خرید به حساب دیگری متصل است.",
          "PURCHASE_OWNERSHIP",
        );
      if (+end > +now) {
        const overlapping = await db.collection("subscription_periods").findOne(
          {
            owner_id: owner,
            starts_at: { $lt: end },
            ends_at: { $gt: cycleStart },
            bazaar_id: { $ne: record._id },
          },
          { session },
        );
        if (overlapping)
          throw fail(
            409,
            "اشتراک دیگری در این دوره فعال است؛ با پشتیبانی تماس بگیرید.",
            "SUBSCRIPTION_OVERLAP",
          );
      }
      // Retire a previous verified cycle only when the provider has confirmed the next one.
      await db.collection("subscription_periods").updateMany(
        {
          owner_id: owner,
          bazaar_id: record._id,
          id: { $ne: periodId },
          ends_at: { $gt: cycleStart },
        },
        { $set: { ends_at: cycleStart } },
        { session },
      );
      await db.collection("subscription_periods").updateOne(
        { order_id: periodId },
        {
          $setOnInsert: {
            id: periodId,
            order_id: periodId,
            owner_id: owner,
            plan_id: record.plan_id,
            provider: "bazaar",
            bazaar_id: record._id,
            starts_at: cycleStart,
          },
          $set: { ends_at: end },
        },
        { upsert: true, session },
      );
      const { _id, ...fields } = record;
      if (existing?.token) fields.token = existing.token;
      await subscriptions.updateOne(
        { _id: record._id },
        {
          $set: {
            ...fields,
            owner_id: owner,
            autoRenewing: state.autoRenewing,
            expires_at: end,
            checked_at: now,
            period_id: periodId,
          },
        },
        { upsert: true, session },
      );
    });
    return {
      ...(await billing.status(owner)),
      subscription: await status(owner),
    };
  }
  async function verifyReceipt(owner, receipt) {
    const data = signedReceipt(receipt);
    const purchaseIntent = await intents.findOne({
      _id: data.developerPayload,
      owner_id: owner,
      product_id: data.productId,
    });
    if (!purchaseIntent)
      throw fail(
        409,
        "این خرید برای حساب فعلی شروع نشده است. به حساب خریدار وارد شوید.",
        "PURCHASE_OWNERSHIP",
      );
    const state = await provider(data.productId, data.purchaseToken);
    const root = state.linkedSubscriptionToken || data.purchaseToken;
    const record = {
      _id: digest(root),
      owner_id: owner,
      product_id: data.productId,
      plan_id: purchaseIntent.plan_id,
      token: seal(data.purchaseToken),
    };
    try {
      return await apply(owner, record, state);
    } catch (error) {
      if (error.code === 11000)
        throw fail(
          409,
          "این خرید قبلاً ثبت شده است. بازیابی خرید را امتحان کنید.",
          "PURCHASE_OWNERSHIP",
        );
      throw error;
    }
  }
  async function status(owner) {
    const row = await subscriptions.findOne(
      { owner_id: owner },
      { sort: { expires_at: -1 } },
    );
    return row
      ? {
          planId: row.plan_id,
          autoRenewing: row.autoRenewing,
          expiresAt: row.expires_at,
          checkedAt: row.checked_at,
        }
      : null;
  }
  async function reconcile(owner) {
    for (const row of await subscriptions.find({ owner_id: owner }).toArray()) {
      try {
        await apply(
          owner,
          row,
          await provider(row.product_id, unseal(row.token)),
        );
      } catch (error) {
        if (error.code !== "BAZAAR_NOT_FOUND") throw error;
        await billing.transaction(async (session) => {
          if (
            !(await db
              .collection("users")
              .findOne({ id: owner, status: { $ne: "deleting" } }, { session }))
          )
            throw fail(409, "حساب در دسترس نیست.", "ACCOUNT_UNAVAILABLE");
          await db.collection("subscription_periods").updateMany(
            {
              owner_id: owner,
              bazaar_id: row._id,
              ends_at: { $gt: new Date() },
            },
            { $set: { ends_at: new Date() } },
            { session },
          );
          await subscriptions.updateOne(
            { _id: row._id },
            {
              $set: {
                autoRenewing: false,
                expires_at: new Date(),
                checked_at: new Date(),
              },
            },
            { session },
          );
        });
      }
    }
    return {
      ...(await billing.status(owner)),
      subscription: await status(owner),
    };
  }
  async function cancel(owner) {
    const row = await subscriptions.findOne(
      { owner_id: owner, autoRenewing: true },
      { sort: { expires_at: -1 } },
    );
    if (!row) return reconcile(owner);
    await provider(row.product_id, unseal(row.token), true);
    await subscriptions.updateOne(
      { _id: row._id },
      { $set: { autoRenewing: false, checked_at: new Date() } },
    );
    return {
      ...(await billing.status(owner)),
      subscription: await status(owner),
    };
  }
  return { intent, verifyReceipt, reconcile, cancel, status };
}

export function bazaarRoutes(app, auth, db, billing, options) {
  const service = bazaarService(db, billing, options);
  app.get("/api/billing/bazaar/products", (req, res) =>
    res.json({
      products: bazaarProducts(),
      available: bazaarConfigured() || !!options.bazaarProvider,
    }),
  );
  app.post("/api/billing/bazaar/intent", auth, async (req, res) =>
    res.json(await service.intent(req.user.id, req.body.planId)),
  );
  app.post("/api/billing/bazaar/verify", auth, async (req, res) =>
    res.json(await service.verifyReceipt(req.user.id, req.body)),
  );
  app.post("/api/billing/bazaar/reconcile", auth, async (req, res) =>
    res.json(await service.reconcile(req.user.id)),
  );
  app.post("/api/billing/bazaar/cancel", auth, async (req, res) =>
    res.json(await service.cancel(req.user.id)),
  );
  app.get("/api/billing/bazaar/status", auth, async (req, res) =>
    res.json(await service.status(req.user.id)),
  );
  return service;
}
