import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, generateKeyPairSync, sign } from "node:crypto";
import { testDatabase } from "./helpers.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { createApp } from "../apps/backend/src/app.js";
import { billingService } from "../apps/backend/src/modules/billing/service.js";
import { bazaarService } from "../apps/backend/src/modules/billing/bazaar.js";
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
test("native OTP is bound to challenge secret; bearer sessions are hashed, revoked and origin-checked", async () => {
  const identifier = `${randomUUID()}@example.com`,
    agent = request(app);
  const { body: challenge } = await agent
    .post("/api/mobile/auth/challenge")
    .set("origin", "https://localhost")
    .send({ identifier, privacyConsent: "2026-11-15" })
    .expect(200);
  const proof = { ...challenge, code: codes.get(identifier) };
  await agent
    .post("/api/mobile/auth/verify")
    .send({ ...proof, challengeSecret: "0".repeat(64) })
    .expect(400);
  const { body: login } = await agent
    .post("/api/mobile/auth/verify")
    .set("origin", "https://localhost")
    .send(proof)
    .expect(200);
  assert.match(login.token, /^[a-f0-9]{64}$/);
  const stored = await db
    .collection("mobile_sessions")
    .findOne({ owner_id: login.user.id });
  assert.notEqual(stored._id, login.token);
  const headers = `Bearer ${login.token}`;
  await request(app)
    .get("/api/auth/me")
    .set("authorization", headers)
    .expect(200);
  await request(app)
    .put("/api/auth/name")
    .set("origin", "https://localhost")
    .set("authorization", headers)
    .send({ name: "مدرس" })
    .expect(200);
  await request(app)
    .put("/api/auth/name")
    .set("origin", "https://localhost")
    .send({ name: "مدرس" })
    .expect(403);
  const user = await db.collection("users").findOne({ id: login.user.id });
  assert.equal(user.privacy_consent.version, "2026-11-15");
  await request(app)
    .post("/api/mobile/auth/logout")
    .set("authorization", headers)
    .expect(200);
  await request(app)
    .get("/api/auth/me")
    .set("authorization", headers)
    .expect(401);
});
test("signed Bazaar purchases bind owner, deduplicate quotas, retain access on cancel and handle outage/refund", async () => {
  const previous = process.env.BAZAAR_SKU_STANDARD;
  process.env.BAZAAR_SKU_STANDARD = "standard-month";
  try {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const billing = billingService(db, fixture.client),
      owner = randomUUID(),
      other = randomUUID();
    await db.collection("users").insertMany([
      { id: owner, lifetime_created: 0 },
      { id: other, lifetime_created: 0 },
    ]);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    let outage = false,
      missing = false;
    const state = {
      kind: "androidpublisher#subscriptionPurchase",
      initiationTimestampMsec: +start,
      validUntilTimestampMsec: +end,
      autoRenewing: true,
      linkedSubscriptionToken: "root-token",
    };
    const service = bazaarService(db, billing, {
      bazaarPublicKey: publicKey.export({ type: "spki", format: "pem" }),
      bazaarProvider: async ({ cancel }) => {
        if (outage)
          throw Object.assign(new Error("unavailable"), {
            code: "BAZAAR_UNAVAILABLE",
          });
        if (missing)
          throw Object.assign(new Error("not found"), {
            code: "BAZAAR_NOT_FOUND",
          });
        if (cancel) {
          state.autoRenewing = false;
          return {};
        }
        return state;
      },
    });
    const intent = await service.intent(owner, "standard");
    const originalJson = JSON.stringify({
      packageName: "ir.azmounbarg.app",
      productId: intent.productId,
      purchaseToken: "test-token",
      purchaseState: 0,
      developerPayload: intent.payload,
    });
    const receipt = {
      originalJson,
      signature: sign(
        "RSA-SHA1",
        Buffer.from(originalJson),
        privateKey,
      ).toString("base64"),
      productId: intent.productId,
      purchaseToken: "test-token",
    };
    await assert.rejects(service.verifyReceipt(other, receipt), {
      code: "PURCHASE_OWNERSHIP",
    });
    await assert.rejects(
      service.verifyReceipt(owner, {
        ...receipt,
        originalJson: originalJson + " ",
      }),
      { code: "INVALID_RECEIPT" },
    );
    await service.verifyReceipt(owner, receipt);
    await service.verifyReceipt(owner, receipt);
    assert.equal(
      await db
        .collection("subscription_periods")
        .countDocuments({ owner_id: owner }),
      1,
    );
    let current = await billing.current(owner);
    await db
      .collection("usage")
      .insertOne({ owner_id: owner, period_id: current.period.id, count: 7 });
    await service.reconcile(owner);
    assert.equal((await billing.status(owner)).used, 7);
    await service.cancel(owner);
    assert.equal((await billing.status(owner)).plan.id, "standard");
    assert.equal((await service.status(owner)).autoRenewing, false);
    outage = true;
    await assert.rejects(service.reconcile(owner));
    assert.equal((await billing.status(owner)).used, 7);
    outage = false;
    missing = true;
    await service.reconcile(owner);
    assert.equal((await billing.status(owner)).plan.id, "free");
  } finally {
    if (previous === undefined) delete process.env.BAZAAR_SKU_STANDARD;
    else process.env.BAZAAR_SKU_STANDARD = previous;
  }
});

test("production blocks mock checkout and confirmation even for authenticated callers", async () => {
  const agent = request(app),
    identifier = `${randomUUID()}@example.com`;
  const { body: challenge } = await agent
    .post("/api/auth/otp/request")
    .send({ identifier })
    .expect(200);
  await agent
    .post("/api/auth/otp/verify")
    .send({ challengeId: challenge.challengeId, code: codes.get(identifier) })
    .expect(200);
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await agent
      .post("/api/billing/checkout")
      .send({ planId: "standard", idempotencyKey: randomUUID() })
      .expect(503);
    await agent
      .post(`/api/billing/orders/${randomUUID()}/mock-confirm`)
      .expect(404);
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
  }
});
