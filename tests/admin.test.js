import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { createApp } from "../apps/backend/src/app.js";
import { billingService } from "../apps/backend/src/modules/billing/service.js";
import request from "./request.js";
let fixture, db, app;
const codes = new Map();
before(async () => {
  fixture = await testDatabase();
  db = fixture.db;
  await initializeDatabase(db);
  app = createApp(db, {
    test: true,
    mongoClient: fixture.client,
    deliverOtp: async (id, code) => codes.set(id.value, code),
  });
});
after(async () => fixture?.close());
async function login(admin = false) {
  const agent = request.agent(app),
    identifier = randomUUID() + "@example.com";
  const { body: c } = await agent
    .post("/api/auth/otp/request")
    .send({ identifier, admin })
    .expect(200);
  const { body: user } = await agent
    .post("/api/auth/otp/verify")
    .send({ challengeId: c.challengeId, code: codes.get(identifier) })
    .expect(200);
  return { agent, user };
}
test("migration defaults and reruns preserve roles", async () => {
  await db.collection("users").insertOne({ id: "legacy" });
  await initializeDatabase(db);
  assert.equal(
    (await db.collection("users").findOne({ id: "legacy" })).role,
    "user",
  );
  await db
    .collection("users")
    .updateOne({ id: "legacy" }, { $set: { role: "admin" } });
  await initializeDatabase(db);
  assert.equal(
    (await db.collection("users").findOne({ id: "legacy" })).role,
    "admin",
  );
  await db.collection("users").deleteOne({ id: "legacy" });
});
test("bootstrap is restricted to panel login, atomic, and last admin protected", async () => {
  const regular = await login();
  await regular.agent.post("/api/admin/bootstrap").send({}).expect(403);
  await regular.agent.get("/api/admin/users").expect(403);
  await request(app).get("/api/admin/users").expect(401);
  const a = await login(true),
    b = await login(true);
  const results = await Promise.all([
    a.agent.post("/api/admin/bootstrap").send({}).expect(),
    b.agent.post("/api/admin/bootstrap").send({}).expect(),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results[0].status === 200 ? a : b;
  await winner.agent
    .put("/api/admin/users/" + winner.user.id)
    .send({ role: "user", reason: "test" })
    .expect(409);
  await winner.agent
    .delete("/api/admin/users/" + winner.user.id)
    .send({ confirm: winner.user.id, reason: "test" })
    .expect(409);
  await winner.agent.get("/api/admin/overview").expect(200);
});
test("access grants preserve usage on extension, suspension blocks sessions, deletion anonymizes", async () => {
  const adminUser = await db.collection("users").findOne({ role: "admin" });
  const a = await login(true);
  await db
    .collection("users")
    .updateOne({ id: a.user.id }, { $set: { role: "admin" } });
  const target = await login();
  const url = "/api/admin/users/" + target.user.id;
  await a.agent
    .put(url)
    .send({ status: "suspended", reason: "test" })
    .expect(200);
  await target.agent.get("/api/auth/me").expect(401);
  await a.agent.put(url).send({ status: "active", reason: "test" }).expect(200);
  const end = new Date(Date.now() + 86400000).toISOString();
  await a.agent
    .post(url + "/subscription")
    .send({
      action: "grant",
      planId: "professional-ai",
      endsAt: end,
      reason: "gift",
    })
    .expect(200);
  const billing = billingService(db, fixture.client);
  assert.equal(
    (await billing.status(target.user.id)).plan.id,
    "professional-ai",
  );
  const old = await billing.current(target.user.id);
  await db.collection("usage").insertOne({
    owner_id: target.user.id,
    period_id: old.period.id,
    count: 7,
  });
  await a.agent
    .post(url + "/subscription")
    .send({
      action: "extend",
      planId: "professional-ai",
      endsAt: new Date(Date.now() + 172800000).toISOString(),
      reason: "extend",
    })
    .expect(200);
  assert.equal((await billing.status(target.user.id)).used, 7);
  await a.agent
    .post(url + "/subscription")
    .send({ action: "revoke", endsAt: end, reason: "revoke" })
    .expect(200);
  assert.equal((await billing.status(target.user.id)).plan.id, "free");
  await db.collection("orders").insertOne({
    id: randomUUID(),
    owner_id: target.user.id,
    price: 123,
    status: "paid",
  });
  await a.agent
    .delete(url)
    .send({ confirm: target.user.id, reason: "erase" })
    .expect(202);
  assert.equal(
    await db.collection("users").findOne({ id: target.user.id }),
    null,
  );
  assert.equal(
    await db.collection("orders").countDocuments({ owner_id: target.user.id }),
    0,
  );
  assert.equal(await db.collection("orders").countDocuments({ price: 123 }), 1);
  assert.ok(adminUser);
});

test("admin filters and read-only order details exclude ordinary users", async () => {
  const a = await login(true);
  await db
    .collection("users")
    .updateOne({ id: a.user.id }, { $set: { role: "admin" } });
  const { body: result } = await a.agent
    .get("/api/admin/users?role=admin&plan=free")
    .expect(200);
  assert.ok(result.items.some((u) => u.id === a.user.id));
  assert.ok(
    result.items.every(
      (u) => u.role === "admin" && u.effective_plan === "free",
    ),
  );
  const order = await db.collection("orders").findOne({ price: 123 });
  const { body: details } = await a.agent
    .get("/api/admin/orders/" + order.id)
    .expect(200);
  assert.equal(details.order.price, 123);
  await a.agent.get("/api/admin/audit?from=invalid").expect(422);
  await a.agent
    .post("/api/admin/deletions/absent/retry")
    .send({ reason: "retry" })
    .expect(404);
  const regular = await login();
  await regular.agent
    .put("/api/auth/profile")
    .send({ role: "admin" })
    .expect(422);
  await regular.agent.get("/api/admin/orders/" + order.id).expect(403);
});

test("mobile admin intent remains bound to OTP and suspended bearer access is denied", async () => {
  const agent = request(app),
    identifier = randomUUID() + "@example.com";
  const { body: c } = await agent
    .post("/api/mobile/auth/challenge")
    .send({ identifier, admin: true })
    .expect(200);
  const { body: session } = await agent
    .post("/api/mobile/auth/verify")
    .send({ ...c, code: codes.get(identifier) })
    .expect(200);
  await agent
    .post("/api/admin/bootstrap")
    .set("authorization", "Bearer " + session.token)
    .send({})
    .expect(409);
  await db
    .collection("users")
    .updateOne({ id: session.user.id }, { $set: { role: "admin" } });
  await agent
    .get("/api/admin/overview")
    .set("authorization", "Bearer " + session.token)
    .expect(200);
  await db
    .collection("users")
    .updateOne({ id: session.user.id }, { $set: { status: "suspended" } });
  await agent
    .get("/api/admin/overview")
    .set("authorization", "Bearer " + session.token)
    .expect(403);
});

test("failed cleanup keeps account blocked and retry completes the purge", async () => {
  const a = await login(true);
  await db
    .collection("users")
    .updateOne({ id: a.user.id }, { $set: { role: "admin" } });
  const target = await login();
  await db
    .collection("assets")
    .insertOne({ id: randomUUID(), owner_id: target.user.id, filename: null });
  const { body: job } = await a.agent
    .delete("/api/admin/users/" + target.user.id)
    .send({ confirm: target.user.id, reason: "cleanup test" })
    .expect(202);
  assert.equal(
    (await db.collection("admin_deletions").findOne({ id: job.id })).status,
    "failed",
  );
  assert.equal(
    (await db.collection("users").findOne({ id: target.user.id })).status,
    "deleting",
  );
  await target.agent.get("/api/auth/me").expect(401);
  await db
    .collection("assets")
    .updateMany(
      { owner_id: target.user.id },
      { $set: { filename: "nonexistent-admin-test.webp" } },
    );
  await db
    .collection("admin_deletions")
    .updateOne({ id: job.id }, { $set: { files: [] } });
  await a.agent
    .post("/api/admin/deletions/" + job.id + "/retry")
    .send({ reason: "retry cleanup" })
    .expect(200);
  assert.equal(
    (await db.collection("admin_deletions").findOne({ id: job.id })).status,
    "done",
  );
  assert.equal(
    await db.collection("users").findOne({ id: target.user.id }),
    null,
  );
});

test("admin tables include batched user identity summaries without private fields", async () => {
  const a = await login(true);
  await db
    .collection("users")
    .updateOne(
      { id: a.user.id },
      { $set: { role: "admin", name: "مدیر نمونه", phone: "+989121234567" } },
    );
  const orderId = randomUUID();
  await db.collection("orders").insertOne({
    id: orderId,
    owner_id: a.user.id,
    status: "pending",
    created_at: new Date(),
  });
  const { body: orders } = await a.agent
    .get("/api/admin/orders?owner_id=" + a.user.id)
    .expect(200);
  assert.deepEqual(orders.items[0].owner_id_user, {
    id: a.user.id,
    name: "مدیر نمونه",
    phone: "+989121234567",
  });
  await a.agent
    .put("/api/admin/users/" + a.user.id)
    .send({ name: "نام تازه", reason: "identity test" })
    .expect(200);
  const { body: audit } = await a.agent
    .get("/api/admin/audit?actor=" + a.user.id)
    .expect(200);
  assert.equal(audit.items[0].actor_user.name, "نام تازه");
  assert.equal(audit.items[0].target_user.phone, "+989121234567");
  assert.equal(audit.items[0].actor_user.session_version, undefined);
});
