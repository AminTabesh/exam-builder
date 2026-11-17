import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import request from "./request.js";
import { testDatabase } from "./helpers.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { createApp } from "../apps/backend/src/app.js";
import { exampleExam, newQuestion, paragraph } from "@exam/shared/exam.js";
let app, db, client, fixture, assetDir;
const codes = new Map();
const deliverOtp = async (identity, code) => codes.set(identity.value, code);
before(async () => {
  fixture = await testDatabase();
  ({ db, client } = fixture);
  assetDir = await mkdtemp(path.join(os.tmpdir(), "exam-assets-"));
  process.env.ASSET_DIR = assetDir;
  await initializeDatabase(db);
  app = createApp(db, { test: true, mongoClient: client, deliverOtp });
});
after(async () => {
  await fixture?.close();
  await rm(assetDir, { recursive: true, force: true });
});
async function challenge(agent, identifier, link = false) {
  const response = await agent
    .post(link ? "/api/auth/identities/request" : "/api/auth/otp/request")
    .send({ identifier })
    .expect(200);
  const normalized = identifier.includes("@")
    ? identifier.toLowerCase()
    : identifier;
  return {
    challengeId: response.body.challengeId,
    code: codes.get(normalized),
  };
}
async function account(identifier = `${randomUUID()}@example.com`) {
  const agent = request.agent(app);
  const proof = await challenge(agent, identifier);
  const signed = await agent
    .post("/api/auth/otp/verify")
    .send({ ...proof, name: "مدرس آزمایشی" })
    .expect(200);
  agent.cookie = signed.headers["set-cookie"][0].split(";")[0];
  return agent;
}
async function buy(agent, planId = "standard") {
  const order = await agent
    .post("/api/billing/checkout")
    .send({ planId, idempotencyKey: randomUUID() })
    .expect(201);
  await agent
    .post(`/api/billing/orders/${order.body.id}/mock-confirm`)
    .expect(200);
  return order.body;
}
function multipart(name, buffer, filename, type, extra = {}) {
  const boundary = "exam-test-boundary";
  let chunks = [];
  for (const [key, value] of Object.entries(extra))
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return {
    body: Buffer.concat(chunks),
    type: `multipart/form-data; boundary=${boundary}`,
  };
}
test("OTP login rotates sessions, binds challenges, rejects replay and removes password/guest endpoints", async () => {
  const a = request.agent(app),
    b = request.agent(app),
    email = "otp@example.com";
  await a.get("/api/exams").expect(401);
  const proof = await challenge(a, email);
  await b.post("/api/auth/otp/verify").send(proof).expect(400);
  const before = await a.get("/api/auth/me").expect(401);
  const signed = await a.post("/api/auth/otp/verify").send(proof).expect(200);
  assert.equal(signed.body.email, email);
  assert.equal(signed.body.name, "");
  assert.ok(signed.headers["set-cookie"]);
  await a.post("/api/auth/otp/verify").send(proof).expect(400);
  await a
    .post("/api/auth/login")
    .send({ email, password: "anything" })
    .expect(404);
  await a.post("/api/demo/pdf").send({ document: exampleExam() }).expect(404);
  const user = await db.collection("users").findOne({ email });
  assert.equal(user.name, "");
  assert.equal(user.password_hash, undefined);
  await a.post("/api/auth/logout").expect(200);
  await a.get("/api/auth/me").expect(401);
});
test("OTP cooldown, five attempt limit, explicit expiry, and resend replacement", async () => {
  const a = request.agent(app),
    email = "limits@example.com";
  const proof = await challenge(a, email);
  await a.post("/api/auth/otp/request").send({ identifier: email }).expect(429);
  const wrong = proof.code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await a
      .post("/api/auth/otp/verify")
      .send({ ...proof, code: wrong })
      .expect(400);
  await a.post("/api/auth/otp/verify").send(proof).expect(400);
  await db
    .collection("otp_challenges")
    .updateOne({ _id: email }, { $set: { next_at: new Date(0) } });
  const replacement = await challenge(a, email);
  await a.post("/api/auth/otp/verify").send(proof).expect(400);
  await db
    .collection("otp_challenges")
    .updateOne({ _id: email }, { $set: { expires_at: new Date(0) } });
  await a.post("/api/auth/otp/verify").send(replacement).expect(400);
});
test("Iranian digits normalize; verified linked identities share account, conflicting identities never merge", async () => {
  const a = await account(),
    first = (await a.get("/api/auth/me").expect(200)).body;
  const response = await a
    .post("/api/auth/identities/request")
    .send({ identifier: "۰۹۱۲۳۴۵۶۷۸۹" })
    .expect(200);
  await a
    .post("/api/auth/identities/verify")
    .send({
      challengeId: response.body.challengeId,
      code: codes.get("+989123456789"),
    })
    .expect(200);
  const other = await account();
  await db
    .collection("otp_challenges")
    .updateOne({ _id: "+989123456789" }, { $set: { next_at: new Date(0) } });
  const conflict = await challenge(other, "+989123456789", true);
  await other.post("/api/auth/identities/verify").send(conflict).expect(409);
  await db
    .collection("otp_challenges")
    .updateOne({ _id: "+989123456789" }, { $set: { next_at: new Date(0) } });
  const login = await account("+989123456789");
  assert.equal((await login.get("/api/auth/me").expect(200)).body.id, first.id);
});
test("ownership, stale revisions, profile and concurrent writes remain protected", async () => {
  const a = await account(),
    b = await account();
  const row = (
    await a.post("/api/exams").send({ document: exampleExam() }).expect(201)
  ).body;
  for (const method of ["get", "delete"])
    await b[method]("/api/exams/" + row.id).expect(404);
  await b
    .put("/api/exams/" + row.id)
    .send({ document: exampleExam(), revision: 1 })
    .expect(404);
  await b
    .post("/api/exams/" + row.id + "/pdf")
    .send({ kind: "student", revision: 1 })
    .expect(404);
  const results = await Promise.all(
    [1, 2].map(() =>
      a
        .put("/api/exams/" + row.id)
        .send({ document: exampleExam(), revision: 1 })
        .expect(),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  await a.post("/api/exams/" + row.id + "/duplicate").expect(201);
  const profile = { institution: "مدرسه", instructor: "مدرس", year: "۱۴۰۵" };
  await a.put("/api/auth/profile").send(profile).expect(200);
  assert.deepEqual(
    (await a.get("/api/auth/me").expect(200)).body.profile,
    profile,
  );
  await a
    .post("/api/exams")
    .set("Origin", "https://other.invalid")
    .send({ document: exampleExam() })
    .expect(403);
});
test("three lifetime creations are atomic, deletions do not refund, failed validation consumes nothing", async () => {
  const a = await account();
  await a.post("/api/exams").send({ document: {} }).expect(422);
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      a.post("/api/exams").send({ document: exampleExam() }).expect(),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 402).length, 3);
  const row = results.find((r) => r.status === 201).body;
  await a.delete("/api/exams/" + row.id).expect(200);
  await a.post("/api/exams").send({ document: exampleExam() }).expect(402);
  assert.equal((await a.get("/api/billing").expect(200)).body.remaining, 0);
});
test("mock purchase and callback are idempotent, owner checked, priced on server; renewal extends calendar months", async () => {
  const a = await account(),
    b = await account(),
    key = randomUUID();
  const payload = { planId: "standard", idempotencyKey: key, price: 1 };
  const order = (
    await a.post("/api/billing/checkout").send(payload).expect(201)
  ).body;
  assert.equal(order.price, 1490000);
  assert.equal(
    (await a.post("/api/billing/checkout").send(payload).expect(201)).body.id,
    order.id,
  );
  await b.get("/api/billing/orders/" + order.id).expect(404);
  await b.post("/api/billing/orders/" + order.id + "/mock-confirm").expect(404);
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      a.post("/api/billing/orders/" + order.id + "/mock-confirm").expect(200),
    ),
  );
  assert.equal(
    await db
      .collection("subscription_periods")
      .countDocuments({ order_id: order.id }),
    1,
  );
  const initial = (await a.get("/api/billing").expect(200)).body;
  assert.equal(initial.plan.id, "standard");
  assert.equal(initial.remaining, 30);
  await buy(a);
  const renewal = (await a.get("/api/billing").expect(200)).body;
  assert.ok(new Date(renewal.expiresAt) > new Date(initial.expiresAt));
  assert.equal(renewal.remaining, 30);
  await a
    .post("/api/billing/checkout")
    .send({ planId: "professional", idempotencyKey: randomUUID() })
    .expect(409);
  const owner = (await a.get("/api/auth/me").expect(200)).body.id;
  await db
    .collection("subscription_periods")
    .updateMany({ owner_id: owner }, { $set: { ends_at: new Date(0) } });
  assert.equal((await a.get("/api/billing").expect(200)).body.plan.id, "free");
  await buy(a, "professional");
  assert.equal((await a.get("/api/billing").expect(200)).body.remaining, null);
});
test("standard monthly quota, export page cap, renewal rollover and expiry preserve exams", async () => {
  const a = await account();
  await buy(a);
  const user = (await a.get("/api/auth/me").expect(200)).body;
  const period = await db
    .collection("subscription_periods")
    .findOne({ owner_id: user.id });
  await db
    .collection("usage")
    .insertOne({ owner_id: user.id, period_id: period.id, count: 29 });
  const results = await Promise.all(
    [1, 2].map(() =>
      a.post("/api/exams").send({ document: exampleExam() }).expect(),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 402]);
  await db
    .collection("subscription_periods")
    .updateOne({ _id: period._id }, { $set: { ends_at: new Date(0) } });
  assert.equal((await a.get("/api/exams").expect(200)).body.length, 1);
  assert.equal((await a.get("/api/billing").expect(200)).body.plan.id, "free");
  await buy(a);
  assert.equal((await a.get("/api/billing").expect(200)).body.remaining, 30);
});
test("private raster images and fonts are owner checked; invalid fonts rejected, used fonts cannot be deleted", async () => {
  const a = await account(),
    b = await account();
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const data = multipart("image", image, "test.png", "image/png");
  const src = (
    await a
      .post("/api/assets")
      .set("Content-Type", data.type)
      .send(data.body)
      .expect(201)
  ).body.src;
  await a.get(src).expect(200);
  await b.get(src).expect(404);
  const fake = multipart(
    "font",
    Buffer.from("bad-font"),
    "fake.ttf",
    "font/ttf",
    { licenseConfirmed: "true" },
  );
  await a
    .post("/api/fonts")
    .set("Content-Type", fake.type)
    .send(fake.body)
    .expect(422);
  const buffer = await readFile(
    new URL(
      "../node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf",
      import.meta.url,
    ),
  );
  const file = multipart("font", buffer, "math.ttf", "font/ttf", {
    licenseConfirmed: "true",
  });
  const font = (
    await a
      .post("/api/fonts")
      .set("Content-Type", file.type)
      .send(file.body)
      .expect(201)
  ).body;
  await b.get("/api/fonts/" + font.id + "/file").expect(404);
  const doc = exampleExam();
  doc.layout.fontFamily = font.id;
  const row = (await a.post("/api/exams").send({ document: doc }).expect(201))
    .body;
  await a.delete("/api/fonts/" + font.id).expect(409);
  await b.post("/api/exams").send({ document: doc }).expect(422);
  await a.delete("/api/exams/" + row.id).expect(200);
  await a.delete("/api/fonts/" + font.id).expect(200);
});
test("server pagination enforces free page limits without trusting client page counts", async () => {
  const a = await account(),
    doc = exampleExam();
  for (const q of doc.questions) {
    q.pageBreak = true;
  }
  const row = (await a.post("/api/exams").send({ document: doc }).expect(201))
    .body;
  const response = await a
    .post("/api/exams/" + row.id + "/pdf")
    .send({ revision: 1, kind: "student", pages: 1 })
    .expect(402);
  assert.equal(response.body.code, "PAGE_LIMIT");
  await buy(a);
  const pdf = await a
    .post("/api/exams/" + row.id + "/pdf")
    .send({ revision: 1, kind: "student" })
    .expect(200);
  assert.equal(pdf.headers["content-type"], "application/pdf");
});
test("sessions survive replacing Express app", async () => {
  const a = await account();
  const response = await a.get("/api/auth/me").expect(200);
  // Existing Mongo-backed session remains valid after application initialization.
  const renewed = createApp(db, {
    test: true,
    mongoClient: client,
    deliverOtp,
  });
  await request(renewed)
    .get("/api/auth/me")
    .set("Cookie", a.cookie)
    .expect(200);
  await initializeDatabase(db);
  await a.get("/api/auth/me").expect(200);
});

test("legacy migration retains account IDs, documents and ownership while removing passwords and initializing usage", async () => {
  const legacy = client.db("legacy_migration_test");
  await legacy.collection("users").insertOne({
    id: "legacy",
    email: "Teacher@Example.COM",
    password_hash: "old",
    tokens: [],
    session_version: 1,
  });
  await legacy.collection("users").createIndex({ email: 1 }, { unique: true });
  await legacy.collection("exams").insertOne({
    id: "old-exam",
    owner_id: "legacy",
    document: exampleExam(),
    revision: 7,
  });
  await initializeDatabase(legacy);
  await initializeDatabase(legacy);
  const user = await legacy.collection("users").findOne({ id: "legacy" });
  assert.equal(user.email, "teacher@example.com");
  assert.equal(user.password_hash, undefined);
  assert.equal(user.tokens, undefined);
  assert.equal(user.lifetime_created, 1);
  assert.equal(user.session_version, 2);
  assert.equal(
    (await legacy.collection("exams").findOne({ id: "old-exam" })).revision,
    7,
  );
});
test("explicit legacy import creation keys are idempotent under concurrency", async () => {
  const a = await account();
  const key = "legacy-" + randomUUID();
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      a
        .post("/api/exams")
        .send({ document: exampleExam(), creationKey: key })
        .expect(201),
    ),
  );
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
  assert.equal(
    (await a.get("/api/billing").expect(200)).body.lifetimeCreated,
    1,
  );
});

test("configured Nodemailer transport sends the passwordless email code", async () => {
  const messages = [];
  const smtpApp = createApp(db, {
    test: true,
    mongoClient: client,
    mailTransport: { sendMail: async (message) => messages.push(message) },
  });
  const a = request.agent(smtpApp),
    email = "smtp-" + randomUUID() + "@example.com";
  const result = await a
    .post("/api/auth/otp/request")
    .send({ identifier: email })
    .expect(200);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, email);
  const code = messages[0].text.match(/[0-9]{6}/)[0];
  await a
    .post("/api/auth/otp/verify")
    .send({ challengeId: result.body.challengeId, code })
    .expect(200);
});
test("expired checkout does not activate subscription or mark payment paid", async () => {
  const a = await account();
  const order = (
    await a
      .post("/api/billing/checkout")
      .send({ planId: "standard", idempotencyKey: randomUUID() })
      .expect(201)
  ).body;
  await db
    .collection("orders")
    .updateOne({ id: order.id }, { $set: { expires_at: new Date(0) } });
  await a.post("/api/billing/orders/" + order.id + "/mock-confirm").expect(410);
  assert.equal((await a.get("/api/billing").expect(200)).body.plan.id, "free");
  assert.equal(
    (await db.collection("orders").findOne({ id: order.id })).status,
    "pending",
  );
});

test("valid TTF with legacy contextual substitution uploads and exports without fontkit shaping", async () => {
  const { legacyContextFont } = await import("./fixtures/legacy-font.js");
  const fontkit = await import("fontkit");
  const buffer = await legacyContextFont();
  assert.throws(
    () => fontkit.create(buffer).layout("آزمون Exam 123"),
    /set is not iterable/,
  );
  const agent = await account();
  const file = multipart(
    "font",
    buffer,
    "legacy.TTF",
    "application/octet-stream",
    { licenseConfirmed: "true" },
  );
  const uploaded = (
    await agent
      .post("/api/fonts")
      .set("Content-Type", file.type)
      .send(file.body)
      .expect(201)
  ).body;
  const served = await agent.get(`/api/fonts/${uploaded.id}/file`).expect(200);
  assert.match(served.headers["content-type"], /font\/ttf/);
  const document = exampleExam("en");
  document.layout.fontFamily = uploaded.id;
  const row = (await agent.post("/api/exams").send({ document }).expect(201))
    .body;
  const pdf = await agent
    .post(`/api/exams/${row.id}/pdf`)
    .send({ revision: row.revision, kind: "answer-key" })
    .expect(200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
});

test("display names require authentication and persist independently of institution details", async () => {
  await request(app).put("/api/auth/name").send({ name: "مدرس" }).expect(401);
  const owner = await account();
  for (const name of ["", "   ", "x".repeat(101), 123])
    await owner.put("/api/auth/name").send({ name }).expect(422);
  await owner
    .put("/api/auth/name")
    .send({ name: "  سارا احمدی  " })
    .expect(200);
  const result = await owner.get("/api/auth/me").expect(200);
  assert.equal(result.body.name, "سارا احمدی");
  const billing = await owner.get("/api/billing").expect(200);
  assert.equal(billing.body.periodStartsAt, null);
  await buy(owner);
  const paid = await owner.get("/api/billing").expect(200);
  assert.ok(
    new Date(paid.body.periodStartsAt) < new Date(paid.body.periodEndsAt),
  );
});

test("matching-column images cannot bypass ownership checks", async () => {
  const owner = await account();
  const document = exampleExam();
  const q = newQuestion("matching");
  q.body = paragraph("وصل کنید");
  q.matching.left[0].body = {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { src: "/api/assets/" + randomUUID(), width: 100 },
      },
    ],
  };
  document.questions = [q];
  await owner.post("/api/exams").send({ document }).expect(422);
});
