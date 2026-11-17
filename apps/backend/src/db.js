import "./config/env.js";
import { MongoClient } from "mongodb";
export const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/exam?replicaSet=rs0",
  { serverSelectionTimeoutMS: 5000 },
);
export const db = client.db(process.env.MONGODB_DB || undefined);
export async function initializeDatabase(database = db) {
  const topology = await database.command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid")
    throw new Error(
      "MongoDB replica set required. Start compose.dev.yaml or configure a replica set; see README.",
    );
  const migrations = database.collection("migrations");
  if (!(await migrations.findOne({ _id: "002-passwordless-billing" }))) {
    // Normalize first; duplicate identities fail clearly rather than merging private accounts.
    for await (const user of database.collection("users").find({})) {
      const lifetime =
        user.lifetime_created ??
        (await database
          .collection("exams")
          .countDocuments({ owner_id: user.id }));
      await database.collection("users").updateOne(
        { _id: user._id },
        {
          $set: {
            ...(user.email ? { email: user.email.trim().toLowerCase() } : {}),
            lifetime_created: lifetime,
            session_version: (user.session_version || 0) + 1,
          },
          $unset: {
            password_hash: "",
            tokens: "",
            verified: "",
            ...(!user.email ? { email: "" } : {}),
          },
        },
      );
    }
    const indexes = await database
      .collection("users")
      .listIndexes()
      .toArray()
      .catch((e) =>
        e.codeName === "NamespaceNotFound" ? [] : Promise.reject(e),
      );
    for (const index of indexes)
      if (index.name === "email_1" || index.name === "tokens.digest_1")
        await database.collection("users").dropIndex(index.name);
    await database.collection("sessions").deleteMany({});
    await migrations.updateOne(
      { _id: "002-passwordless-billing" },
      { $set: { applied_at: new Date() } },
      { upsert: true },
    );
  }
  await database
    .collection("users")
    .updateMany({ role: { $exists: false } }, { $set: { role: "user" } });
  await database
    .collection("users")
    .updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
  await database
    .collection("admin_state")
    .updateOne(
      { _id: "membership" },
      { $setOnInsert: { version: 0 } },
      { upsert: true },
    );
  const index = (collection, keys, options = {}) =>
    database.collection(collection).createIndex(keys, options);
  await Promise.all([
    index("admin_audit", { created_at: -1 }),
    index("admin_entitlements", { owner_id: 1, created_at: -1 }),
    index("admin_deletions", { id: 1 }, { unique: true }),
    index("users", { role: 1, status: 1 }),
    index("bazaar_subscriptions", { owner_id: 1, expires_at: -1 }),
    index("bazaar_intents", { owner_id: 1, created_at: -1 }),
    index("mobile_sessions", { expires_at: 1 }, { expireAfterSeconds: 0 }),
    index("mobile_sessions", { owner_id: 1 }),
    index("users", { id: 1 }, { unique: true }),
    index(
      "users",
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: "string" } } },
    ),
    index(
      "users",
      { phone: 1 },
      { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
    ),
    index("exams", { id: 1 }, { unique: true }),
    index("exams", { owner_id: 1, updated_at: -1 }),
    index("assets", { id: 1 }, { unique: true }),
    index("assets", { owner_id: 1 }),
    index("sessions", { expires: 1 }, { expireAfterSeconds: 0 }),
    index("otp_challenges", { id: 1 }, { unique: true }),
    index("otp_challenges", { expires_at: 1 }, { expireAfterSeconds: 0 }),
    index("otp_rates", { expires_at: 1 }, { expireAfterSeconds: 0 }),
    index("orders", { id: 1 }, { unique: true }),
    index("orders", { owner_id: 1, idempotency_key: 1 }, { unique: true }),
    index("subscription_periods", { owner_id: 1, starts_at: 1, ends_at: 1 }),
    index("subscription_periods", { order_id: 1 }, { unique: true }),
    index("usage", { owner_id: 1, period_id: 1 }, { unique: true }),
    index("ai_requests", {
      owner_id: 1,
      period_id: 1,
      status: 1,
      lease_until: 1,
    }),
    index("ai_results", { expires_at: 1 }, { expireAfterSeconds: 0 }),
    index("fonts", { id: 1 }, { unique: true }),
    index("fonts", { owner_id: 1 }),
  ]);
}
