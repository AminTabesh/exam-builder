import { randomUUID } from "node:crypto";
import { plans, addMonth } from "./catalog.js";
import { fail } from "../../middleware/errors.js";
export function billingService(db, client) {
  const users = db.collection("users"),
    periods = db.collection("subscription_periods"),
    usage = db.collection("usage"),
    orders = db.collection("orders");
  async function transaction(fn) {
    if (!client) throw new Error("MongoClient required for transactions");
    return client.withSession((session) =>
      session.withTransaction(() => fn(session)),
    );
  }
  async function purchased(owner, session, now = new Date()) {
    const period = await periods.findOne(
      { owner_id: owner, starts_at: { $lte: now }, ends_at: { $gt: now } },
      { session },
    );
    return {
      period,
      plan: plans.find((p) => p.id === period?.plan_id) || plans[0],
    };
  }
  async function current(owner, session, now = new Date()) {
    const override = await db
      .collection("admin_entitlements")
      .findOne(
        { owner_id: owner, starts_at: { $lte: now }, ends_at: { $gt: now } },
        { session, sort: { created_at: -1, id: -1 } },
      );
    if (!override) return purchased(owner, session, now);
    return {
      period: override.plan_id === "free" ? null : override,
      plan: plans.find((p) => p.id === override.plan_id) || plans[0],
      override,
    };
  }
  async function status(owner) {
    const { period, plan, override } = await current(owner);
    const user = await users.findOne({ id: owner });
    const used = period
      ? (await usage.findOne({ owner_id: owner, period_id: period.id }))
          ?.count || 0
      : user.lifetime_created || 0;
    const last =
      override ||
      (await periods.findOne(
        { owner_id: owner, ends_at: { $gt: new Date() } },
        { sort: { ends_at: -1 } },
      ));
    const aiLimit = plan.aiGenerations || 0;
    const aiScope = { owner_id: owner, period_id: period?.id || "" };
    const aiUsed = await db
      .collection("ai_requests")
      .countDocuments({ ...aiScope, status: "succeeded" });
    const aiReserved = await db.collection("ai_requests").countDocuments({
      ...aiScope,
      status: "pending",
      lease_until: { $gt: new Date() },
    });
    return {
      ai: {
        limit: aiLimit,
        used: aiUsed,
        remaining: Math.max(0, aiLimit - aiUsed - aiReserved),
      },
      plan,
      used,
      remaining: plan.exams === null ? null : Math.max(0, plan.exams - used),
      override: override
        ? {
            id: override.id,
            endsAt: override.ends_at,
            planId: override.plan_id,
          }
        : null,
      periodStartsAt: period?.starts_at || null,
      periodEndsAt: period?.ends_at || null,
      expiresAt: last?.ends_at || null,
      lifetimeCreated: user.lifetime_created || 0,
    };
  }
  async function createExam(owner, document, creationKey) {
    if (
      creationKey !== undefined &&
      (typeof creationKey !== "string" ||
        !/^[a-zA-Z0-9-]{16,100}$/.test(creationKey))
    )
      throw fail(422, "شناسه ایجاد معتبر نیست.", "INVALID_CREATION_KEY");
    let row = {
      id: randomUUID(),
      owner_id: owner,
      ...(creationKey ? { creation_key: creationKey } : {}),
      document,
      revision: 1,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await transaction(async (session) => {
      if (creationKey) {
        const existing = await db
          .collection("exams")
          .findOne(
            { owner_id: owner, creation_key: creationKey },
            { session, projection: { _id: 0 } },
          );
        if (existing) {
          row = existing;
          return;
        }
      }
      const { period, plan } = await current(owner, session);
      const user = await users.findOne({ id: owner }, { session });
      if (!period && (user.lifetime_created || 0) >= 3)
        throw fail(
          402,
          "سهمیه سه آزمون رایگان شما تمام شده است. یک طرح انتخاب کنید.",
          "EXAM_QUOTA",
        );
      if (period) {
        const key = { owner_id: owner, period_id: period.id };
        const previous = await usage.findOne(key, { session });
        if (plan.exams !== null && (previous?.count || 0) >= plan.exams)
          throw fail(
            402,
            "سهمیه ساخت آزمون این دوره تمام شده است.",
            "EXAM_QUOTA",
          );
        await usage.updateOne(
          key,
          { $inc: { count: 1 } },
          { session, upsert: true },
        );
      }
      // Every creator writes the same user document, preventing concurrent free-quota overruns.
      await users.updateOne(
        { id: owner },
        { $inc: { lifetime_created: 1 } },
        { session },
      );
      if (
        /^[a-f0-9-]{36}$/.test(document.layout.fontFamily || "") &&
        !(await db
          .collection("fonts")
          .findOne(
            { id: document.layout.fontFamily, owner_id: owner },
            { session },
          ))
      )
        throw fail(422, "فونت پیدا نشد.", "FONT_NOT_FOUND");
      await db.collection("exams").insertOne({ ...row }, { session });
    });
    return row;
  }
  async function checkout(owner, planId, key) {
    const plan = plans.find((p) => p.id === planId && p.price > 0);
    if (!plan || typeof key !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(key))
      throw fail(422, "طرح یا شناسه خرید معتبر نیست.", "INVALID_CHECKOUT");
    const existing = await orders.findOne(
      { owner_id: owner, idempotency_key: key },
      { projection: { _id: 0 } },
    );
    if (existing) {
      if (existing.plan_id !== planId)
        throw fail(
          409,
          "شناسه خرید قبلاً برای طرح دیگری استفاده شده است.",
          "CHECKOUT_CONFLICT",
        );
      return existing;
    }
    const { plan: active, period } = await purchased(owner);
    if (period && active.id !== planId)
      throw fail(
        409,
        "تغییر طرح پس از پایان اشتراک فعلی امکان‌پذیر است.",
        "PLAN_CHANGE_UNAVAILABLE",
      );
    const order = {
      id: randomUUID(),
      owner_id: owner,
      idempotency_key: key,
      plan_id: planId,
      price: plan.price,
      currency: plan.currency,
      provider: "mock",
      status: "pending",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 15 * 60000),
    };
    try {
      await orders.insertOne({ ...order });
    } catch (e) {
      if (e.code !== 11000) throw e;
      const retry = await orders.findOne(
        { owner_id: owner, idempotency_key: key },
        { projection: { _id: 0 } },
      );
      if (retry.plan_id !== planId)
        throw fail(409, "شناسه خرید تکراری است.", "CHECKOUT_CONFLICT");
      return retry;
    }
    return order;
  }
  async function ownedOrder(owner, id, session) {
    const order = await orders.findOne(
      { id, owner_id: owner },
      { session, projection: { _id: 0 } },
    );
    if (!order) throw fail(404, "خرید پیدا نشد.", "ORDER_NOT_FOUND");
    return order;
  }
  async function confirm(owner, id) {
    await transaction(async (session) => {
      const order = await ownedOrder(owner, id, session);
      if (order.status === "paid") return;
      if (order.expires_at <= new Date())
        throw fail(
          410,
          "مهلت پرداخت تمام شده است؛ دوباره خرید کنید.",
          "ORDER_EXPIRED",
        );
      // Serialize activation against other orders and quota changes for this account.
      await users.updateOne(
        { id: owner },
        { $inc: { billing_version: 1 } },
        { session },
      );
      const last = await periods.findOne(
        { owner_id: owner, ends_at: { $gt: new Date() } },
        { session, sort: { ends_at: -1 } },
      );
      if (last && last.plan_id !== order.plan_id)
        throw fail(
          409,
          "تغییر طرح پس از پایان اشتراک فعلی امکان‌پذیر است.",
          "PLAN_CHANGE_UNAVAILABLE",
        );
      const anchor = last?.anchor || new Date(),
        index = last ? last.month_index + 1 : 0;
      const start = last?.ends_at || anchor;
      await periods.insertOne(
        {
          id: randomUUID(),
          owner_id: owner,
          order_id: order.id,
          plan_id: order.plan_id,
          anchor,
          month_index: index,
          starts_at: start,
          ends_at: addMonth(anchor, index + 1),
        },
        { session },
      );
      await orders.updateOne(
        { id },
        { $set: { status: "paid", paid_at: new Date() } },
        { session },
      );
    });
    return ownedOrder(owner, id);
  }
  return {
    status,
    current,
    purchased,
    createExam,
    checkout,
    confirm,
    ownedOrder,
    transaction,
  };
}
