import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fail } from "../../middleware/errors.js";
import { userView } from "../auth/service.js";
import { plans } from "../billing/catalog.js";
export function adminRoutes(app, auth, db, billing, root) {
  const users = db.collection("users");
  const lock = (session) =>
    db
      .collection("admin_state")
      .updateOne({ _id: "membership" }, { $inc: { version: 1 } }, { session });
  async function authorize(req, session) {
    const result = await users.updateOne(
      {
        id: req.user.id,
        role: "admin",
        status: "active",
        session_version: req.user.session_version,
      },
      { $inc: { admin_version: 1 } },
      { session },
    );
    if (!result.matchedCount)
      throw fail(403, "دسترسی مدیریت تغییر کرده است.", "ADMIN_REQUIRED");
  }
  const audit = (req, action, target, changes, session) =>
    db.collection("admin_audit").insertOne(
      {
        id: randomUUID(),
        actor: req.user.id,
        action,
        target,
        reason: req.body?.reason || "",
        changes,
        created_at: new Date(),
      },
      { session },
    );
  const reason = (req) => {
    if (
      typeof req.body?.reason !== "string" ||
      !req.body.reason.trim() ||
      req.body.reason.length > 500
    )
      throw fail(422, "دلیل تغییر را وارد کنید.");
  };
  const admin = async (req, res, next) => {
    try {
      if (req.user.role !== "admin")
        throw fail(403, "دسترسی مدیر لازم است.", "ADMIN_REQUIRED");
      next();
    } catch (e) {
      next(e);
    }
  };
  app.get("/api/admin/bootstrap", (req, res) =>
    users
      .countDocuments({ role: "admin" })
      .then((n) => res.json({ available: n === 0 })),
  );
  app.post("/api/admin/bootstrap", auth, async (req, res) => {
    const login = req.mobileSession?.adminLogin || req.session.adminLogin;
    if (!login || Date.now() - login > 300000)
      throw fail(403, "از صفحه مدیریت دوباره وارد شوید.");
    await billing.transaction(async (session) => {
      await lock(session);
      if (await users.countDocuments({ role: "admin" }, { session }))
        throw fail(409, "مدیر قبلاً تعیین شده است.");
      if (
        !(
          await users.updateOne(
            { id: req.user.id, status: "active" },
            { $set: { role: "admin" } },
            { session },
          )
        ).matchedCount
      )
        throw fail(403, "حساب فعال نیست.");
      await audit(req, "bootstrap", req.user.id, { role: "admin" }, session);
    });
    delete req.session.adminLogin;
    res.json(userView(await users.findOne({ id: req.user.id })));
  });
  app.use("/api/admin", auth, admin);
  const paging = (req) => ({
    skip:
      (Math.max(1, Math.min(100000, Math.floor(Number(req.query.page)) || 1)) -
        1) *
      25,
    limit: 25,
  });
  const effectivePipeline = () => {
    const now = new Date();
    const lookup = (from, as, sorted = false) => ({
      $lookup: {
        from,
        let: { owner: "$id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$owner_id", "$$owner"] },
                  { $lte: ["$starts_at", now] },
                  { $gt: ["$ends_at", now] },
                ],
              },
            },
          },
          ...(sorted ? [{ $sort: { created_at: -1, id: -1 } }] : []),
          { $limit: 1 },
        ],
        as,
      },
    });
    return [
      lookup("admin_entitlements", "override", true),
      lookup("subscription_periods", "purchase"),
      {
        $set: {
          effective_plan: {
            $ifNull: [
              { $arrayElemAt: ["$override.plan_id", 0] },
              { $ifNull: [{ $arrayElemAt: ["$purchase.plan_id", 0] }, "free"] },
            ],
          },
        },
      },
    ];
  };
  async function withUsers(items) {
    const ids = [
      ...new Set(
        items
          .flatMap((item) => [item.owner_id, item.actor, item.target])
          .filter((id) => typeof id === "string"),
      ),
    ];
    const people = await users
      .find(
        { id: { $in: ids } },
        { projection: { _id: 0, id: 1, name: 1, phone: 1 } },
      )
      .toArray();
    const map = new Map(people.map((person) => [person.id, person]));
    return items.map((item) => ({
      ...item,
      ...Object.fromEntries(
        ["owner_id", "actor", "target"]
          .filter((key) => item[key])
          .map((key) => [key + "_user", map.get(item[key]) || null]),
      ),
    }));
  }
  const list = async (collection, filter, req, projection = { _id: 0 }) => ({
    items: await withUsers(
      await db
        .collection(collection)
        .find(filter, { projection })
        .sort({ created_at: -1, id: 1 })
        .skip(paging(req).skip)
        .limit(25)
        .toArray(),
    ),
    total: await db.collection(collection).countDocuments(filter),
  });
  app.get("/api/admin/overview", async (req, res) =>
    res.json({
      users: await users.countDocuments(),
      active: await users.countDocuments({ status: "active" }),
      exams: await db.collection("exams").countDocuments(),
      ai: await db
        .collection("ai_requests")
        .countDocuments({ status: "succeeded" }),
      orders: await db.collection("orders").countDocuments(),
      subscriptions: await users
        .aggregate([
          { $match: { status: "active" } },
          ...effectivePipeline(),
          { $match: { effective_plan: { $ne: "free" } } },
          { $count: "count" },
        ])
        .toArray(),
      ordersByStatus: await db
        .collection("orders")
        .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
      revenue: await db
        .collection("orders")
        .aggregate([
          { $match: { status: "paid", provider: { $ne: "mock" } } },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ])
        .toArray(),
      recent: await db
        .collection("admin_audit")
        .find({}, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray(),
    }),
  );
  app.get("/api/admin/users", async (req, res) => {
    const f = {};
    if (req.query.q) {
      const q = String(req.query.q)
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      f.$or = ["name", "email", "phone"].map((k) => ({
        [k]: { $regex: q, $options: "i" },
      }));
    }
    for (const k of ["role", "status"])
      if (req.query[k]) f[k] = String(req.query[k]);
    const pipeline = [
      { $match: f },
      ...effectivePipeline(),
      ...(req.query.plan
        ? [{ $match: { effective_plan: String(req.query.plan) } }]
        : []),
    ];
    const [result] = await users
      .aggregate([
        ...pipeline,
        {
          $facet: {
            items: [
              { $sort: { created_at: -1, id: 1 } },
              { $skip: paging(req).skip },
              { $limit: 25 },
              {
                $project: {
                  _id: 0,
                  id: 1,
                  name: 1,
                  email: 1,
                  phone: 1,
                  role: 1,
                  status: 1,
                  effective_plan: 1,
                  created_at: 1,
                },
              },
            ],
            count: [{ $count: "total" }],
          },
        },
      ])
      .toArray();
    result.total = result.count[0]?.total || 0;
    delete result.count;
    res.json(result);
  });
  app.get("/api/admin/users/:id", async (req, res) => {
    const u = await users.findOne({ id: req.params.id });
    if (!u) throw fail(404, "کاربر پیدا نشد.");
    res.json({
      ...userView(u),
      created_at: u.created_at,
      billing: await billing.status(u.id),
      exams: await db.collection("exams").countDocuments({ owner_id: u.id }),
      orders: await db
        .collection("orders")
        .find({ owner_id: u.id }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray(),
      overrides: await db
        .collection("admin_entitlements")
        .find({ owner_id: u.id }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray(),
    });
  });
  app.put("/api/admin/users/:id", async (req, res) => {
    reason(req);
    const changes = {};
    for (const k of ["name", "role", "status", "profile"])
      if (req.body[k] !== undefined) changes[k] = req.body[k];
    if (
      changes.name !== undefined &&
      (typeof changes.name !== "string" ||
        !changes.name.trim() ||
        changes.name.length > 100)
    )
      throw fail(422, "نام معتبر نیست.");
    if (
      (changes.role !== undefined &&
        !["user", "admin"].includes(changes.role)) ||
      (changes.status !== undefined &&
        !["active", "suspended"].includes(changes.status))
    )
      throw fail(422, "نقش یا وضعیت معتبر نیست.");
    if (
      changes.profile !== undefined &&
      (!changes.profile ||
        typeof changes.profile !== "object" ||
        Array.isArray(changes.profile) ||
        Object.entries(changes.profile).some(
          ([k, v]) =>
            ![
              "institution",
              "instructor",
              "faculty",
              "department",
              "year",
            ].includes(k) ||
            typeof v !== "string" ||
            v.length > 200,
        ))
    )
      throw fail(422, "مشخصات معتبر نیست.");
    await billing.transaction(async (session) => {
      await authorize(req, session);
      await lock(session);
      const u = await users.findOne({ id: req.params.id }, { session });
      if (!u) throw fail(404, "کاربر پیدا نشد.");
      if (u.status === "deleting") throw fail(409, "حذف در حال انجام است.");
      if (
        u.role === "admin" &&
        u.status === "active" &&
        (changes.role === "user" || changes.status === "suspended") &&
        (await users.countDocuments(
          { role: "admin", status: "active" },
          { session },
        )) <= 1
      )
        throw fail(409, "آخرین مدیر فعال قابل حذف نیست.");
      await users.updateOne(
        { id: u.id },
        {
          $set: changes,
          ...(changes.status === "suspended"
            ? { $inc: { session_version: 1 } }
            : {}),
        },
        { session },
      );
      await audit(req, "user.update", u.id, changes, session);
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/users/:id/revoke-sessions", async (req, res) => {
    reason(req);
    await billing.transaction(async (session) => {
      await authorize(req, session);
      if (
        !(
          await users.updateOne(
            { id: req.params.id },
            { $inc: { session_version: 1 } },
            { session },
          )
        ).matchedCount
      )
        throw fail(404, "کاربر پیدا نشد.");
      await audit(req, "sessions.revoke", req.params.id, {}, session);
    });
    res.json({ ok: true });
  });
  app.post("/api/admin/users/:id/subscription", async (req, res) => {
    reason(req);
    const { action, planId } = req.body;
    const end = new Date(req.body.endsAt);
    if (
      !["grant", "extend", "replace", "revoke"].includes(action) ||
      !Number.isFinite(+end) ||
      end <= new Date() ||
      (!plans.some((p) => p.id === planId) && action !== "revoke")
    )
      throw fail(422, "طرح یا تاریخ معتبر نیست.");
    await billing.transaction(async (session) => {
      await authorize(req, session);
      const u = await users.findOneAndUpdate(
        { id: req.params.id, status: { $ne: "deleting" } },
        { $inc: { billing_version: 1 } },
        { session, returnDocument: "after" },
      );
      if (!u) throw fail(404, "کاربر پیدا نشد.");
      const old = await db
        .collection("admin_entitlements")
        .findOne(
          { owner_id: u.id, ends_at: { $gt: new Date() } },
          { session, sort: { created_at: -1 } },
        );
      if (action === "extend") {
        if (!old || end <= old.ends_at)
          throw fail(
            409,
            "تمدید نیازمند دسترسی مدیریتی فعال و تاریخ پایان دیرتر است.",
          );
        await db
          .collection("admin_entitlements")
          .updateOne({ id: old.id }, { $set: { ends_at: end } }, { session });
      } else {
        await db.collection("admin_entitlements").insertOne(
          {
            id: randomUUID(),
            owner_id: u.id,
            plan_id: action === "revoke" ? "free" : planId,
            starts_at: new Date(),
            ends_at: end,
            created_at: new Date(),
            order_id: "admin-" + randomUUID(),
            source: "admin",
          },
          { session },
        );
      }
      await audit(
        req,
        "subscription." + action,
        u.id,
        { planId, endsAt: end },
        session,
      );
    });
    res.json({ ok: true });
  });
  app.get("/api/admin/orders/:id", async (req, res) => {
    const order = await db
      .collection("orders")
      .findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!order) throw fail(404, "خرید پیدا نشد.");
    const periods = await db
      .collection("subscription_periods")
      .find({ order_id: order.id }, { projection: { _id: 0 } })
      .toArray();
    res.json({ order, periods });
  });
  for (const [url, collection] of [
    ["orders", "orders"],
    ["audit", "admin_audit"],
    ["usage", "ai_requests"],
  ])
    app.get("/api/admin/" + url, async (req, res) => {
      const f = {};
      for (const k of url === "audit"
        ? ["actor", "target", "action"]
        : ["owner_id", "status"])
        if (req.query[k]) f[k] = String(req.query[k]);
      if (url === "audit") {
        for (const [key, op] of [
          ["from", "$gte"],
          ["to", "$lte"],
        ])
          if (req.query[key]) {
            const date = new Date(req.query[key]);
            if (!Number.isFinite(+date)) throw fail(422, "تاریخ معتبر نیست.");
            f.created_at = { ...f.created_at, [op]: date };
          }
      }
      res.json(
        await list(
          collection,
          f,
          req,
          url === "usage"
            ? {
                _id: 0,
                id: 1,
                owner_id: 1,
                status: 1,
                created_at: 1,
                period_id: 1,
              }
            : { _id: 0 },
        ),
      );
    });
  async function clean(id) {
    const job = await db.collection("admin_deletions").findOne({ id });
    if (!job) throw fail(404, "درخواست حذف پیدا نشد.");
    if (job.status === "done") return;
    try {
      const discovered = [
        ...(await db
          .collection("assets")
          .find({ owner_id: job.owner_id })
          .toArray()),
        ...(
          await db
            .collection("fonts")
            .find({ owner_id: job.owner_id })
            .toArray()
        ).map((f) => ({ ...f, font: true })),
      ];
      for (const file of [...job.files, ...discovered]) {
        const filename = path.basename(file.filename);
        await unlink(path.join(root, file.font ? "fonts" : "", filename)).catch(
          (e) => {
            if (e.code !== "ENOENT") throw e;
          },
        );
      }
      await billing.transaction(async (session) => {
        for (const c of [
          "exams",
          "assets",
          "fonts",
          "usage",
          "ai_requests",
          "ai_results",
          "admin_entitlements",
          "mobile_sessions",
          "bazaar_intents",
        ])
          await db
            .collection(c)
            .deleteMany({ owner_id: job.owner_id }, { session });
        for (const c of [
          "orders",
          "subscription_periods",
          "bazaar_subscriptions",
        ])
          await db.collection(c).updateMany(
            { owner_id: job.owner_id },
            {
              $set: { owner_id: "deleted-" + id },
              $unset: { purchase_token: "", token: "", email: "", phone: "" },
            },
            { session },
          );
        await db
          .collection("admin_audit")
          .updateMany(
            { actor: job.owner_id },
            { $set: { actor: "deleted-" + id } },
            { session },
          );
        await db.collection("admin_audit").updateMany(
          { target: job.owner_id },
          {
            $set: {
              target: "deleted-" + id,
              changes: { redacted: true },
              reason: "حساب حذف شده",
            },
          },
          { session },
        );
        const user = await users.findOne({ id: job.owner_id }, { session });
        if (user)
          await db
            .collection("otp_challenges")
            .deleteMany(
              { _id: { $in: [user.email, user.phone].filter(Boolean) } },
              { session },
            );
        const escapedOwner = job.owner_id.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        await db.collection("sessions").deleteMany(
          {
            $or: [
              { "session.userId": job.owner_id },
              {
                session: {
                  $regex: '"userId"\\s*:\\s*"' + escapedOwner + '"',
                },
              },
            ],
          },
          { session },
        );
        await users.deleteOne({ id: job.owner_id }, { session });
        await db
          .collection("admin_deletions")
          .updateOne(
            { id },
            { $set: { status: "done", files: [], owner_id: null } },
            { session },
          );
      });
    } catch {
      await db
        .collection("admin_deletions")
        .updateOne({ id }, { $set: { status: "failed" } });
    }
  }
  app.delete("/api/admin/users/:id", async (req, res) => {
    reason(req);
    if (req.body.confirm !== req.params.id)
      throw fail(422, "شناسه کاربر را تأیید کنید.");
    const id = randomUUID();
    await billing.transaction(async (session) => {
      await authorize(req, session);
      await lock(session);
      const u = await users.findOne({ id: req.params.id }, { session });
      if (!u) throw fail(404, "کاربر پیدا نشد.");
      if (u.status === "deleting") throw fail(409, "حذف قبلاً شروع شده است.");
      if (
        u.role === "admin" &&
        u.status === "active" &&
        (await users.countDocuments(
          { role: "admin", status: "active" },
          { session },
        )) <= 1
      )
        throw fail(409, "آخرین مدیر فعال قابل حذف نیست.");
      const files = [
        ...(await db
          .collection("assets")
          .find({ owner_id: u.id }, { session })
          .toArray()),
        ...(
          await db
            .collection("fonts")
            .find({ owner_id: u.id }, { session })
            .toArray()
        ).map((f) => ({ ...f, font: true })),
      ].map(({ filename, font }) => ({ filename, font: !!font }));
      await users.updateOne(
        { id: u.id },
        { $set: { status: "deleting" }, $inc: { session_version: 1 } },
        { session },
      );
      await db.collection("admin_deletions").insertOne(
        {
          id,
          owner_id: u.id,
          files,
          status: "pending",
          created_at: new Date(),
        },
        { session },
      );
      await audit(req, "user.delete", u.id, {}, session);
    });
    await clean(id);
    res.status(202).json({ id });
  });
  app.get("/api/admin/deletions", async (req, res) =>
    res.json(await list("admin_deletions", {}, req, { _id: 0, files: 0 })),
  );
  app.post("/api/admin/deletions/:id/retry", async (req, res) => {
    reason(req);
    await clean(req.params.id);
    await audit(req, "deletion.retry", req.params.id, {}, undefined);
    res.json({ ok: true });
  });
}
