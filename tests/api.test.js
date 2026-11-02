import { spawnSync } from "node:child_process";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { initializeDatabase } from "../server/db.js";
import request from "./request.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { exampleExam } from "../shared/exam.js";
let app, db, mongo, client, assetDir;
const messages = [];
before(async () => {
  assetDir = await mkdtemp(path.join(os.tmpdir(), "exam-test-assets-"));
  process.env.ASSET_DIR = assetDir;
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY ||
    spawnSync(process.platform === "win32" ? "where" : "which", ["mongod"], {
      encoding: "utf8",
    })
      .stdout?.trim()
      .split("\n")[0];
  const version =
    systemBinary &&
    (process.env.MONGOMS_VERSION ||
      spawnSync(systemBinary, ["--version"], {
        encoding: "utf8",
      }).stdout?.match(/db version v([\d.]+)/)?.[1]);
  mongo = await MongoMemoryServer.create({
    binary: systemBinary ? { systemBinary, version } : undefined,
  });
  client = new MongoClient(mongo.getUri());
  db = client.db("exam_test");
  await initializeDatabase(db);
  app = createApp(db, {
    test: true,
    mongoClient: client,
    mailTransport: { sendMail: async (m) => messages.push(m) },
  });
});
async function account(email) {
  const agent = request.agent(app);
  const password = "password-12345";
  await agent
    .post("/api/auth/register")
    .send({ name: "مدرس آزمایشی", email, password })
    .expect(201);
  const token = messages
    .find((m) => m.to === email)
    .text.match(/token=([a-f0-9]+)/)[1];
  await agent
    .post("/api/auth/token")
    .send({ token, kind: "verify" })
    .expect(200);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}
test("authentication, ownership, stale revisions, duplicate and delete", async () => {
  const a = await account("a@example.com"),
    b = await account("b@example.com");
  await request(app).get("/api/exams").expect(401);
  const created = await a
    .post("/api/exams")
    .send({ document: exampleExam() })
    .expect(201);
  const id = created.body.id;
  await b.get("/api/exams/" + id).expect(404);
  await b
    .put("/api/exams/" + id)
    .send({ document: exampleExam(), revision: 1 })
    .expect(404);
  await b.delete("/api/exams/" + id).expect(404);
  await b
    .post("/api/exams/" + id + "/pdf")
    .send({ revision: 1, kind: "student" })
    .expect(404);
  await a
    .put("/api/exams/" + id)
    .send({ document: exampleExam(), revision: 1 })
    .expect(200);
  await a
    .put("/api/exams/" + id)
    .send({ document: exampleExam(), revision: 1 })
    .expect(409);
  const copy = await a
    .post("/api/exams/" + id + "/duplicate")
    .send({})
    .expect(201);
  assert.notEqual(copy.body.id, id);
  await a.delete("/api/exams/" + id).expect(200);
  await a.get("/api/exams/" + id).expect(404);
  await a.post("/api/auth/logout").expect(200);
  await a.get("/api/exams").expect(401);
});
test("verification tokens are single-use and unverified accounts cannot create", async () => {
  const a = request.agent(app);
  await a
    .post("/api/auth/register")
    .send({
      name: "Test",
      email: "verify@example.com",
      password: "password-12345",
    })
    .expect(201);
  await a
    .post("/api/auth/login")
    .send({ email: "verify@example.com", password: "password-12345" })
    .expect(200);
  await a.post("/api/exams").send({ document: exampleExam() }).expect(403);
  const token = messages
    .find((m) => m.to === "verify@example.com")
    .text.match(/token=([a-f0-9]+)/)[1];
  await a.post("/api/auth/token").send({ token, kind: "verify" }).expect(200);
  await a.post("/api/auth/token").send({ token, kind: "verify" }).expect(400);
});
test("cross-origin writes and unowned assets rejected", async () => {
  const a = await account("asset@example.com");
  await a
    .post("/api/exams")
    .set("Origin", "https://evil.test")
    .send({ document: exampleExam() })
    .expect(403);
  const e = exampleExam();
  e.meta.logo = "/api/assets/11111111-1111-4111-8111-111111111111";
  await a.post("/api/exams").send({ document: e }).expect(422);
  await a.get("/api/assets/11111111-1111-4111-8111-111111111111").expect(404);
});

test("password recovery revokes sessions, consumes tokens, and changes credentials", async () => {
  const a = await account("recovery@example.com");
  await a
    .post("/api/auth/recover")
    .send({ email: "recovery@example.com" })
    .expect(200);
  const token = messages
    .filter((m) => m.to === "recovery@example.com")
    .at(-1)
    .text.match(/token=([a-f0-9]+)/)[1];
  await a
    .post("/api/auth/token")
    .send({ token, kind: "reset", password: "new-password-456" })
    .expect(200);
  await a.get("/api/auth/me").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "recovery@example.com", password: "password-12345" })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "recovery@example.com", password: "new-password-456" })
    .expect(200);
  await request(app)
    .post("/api/auth/token")
    .send({ token, kind: "reset", password: "another-password" })
    .expect(400);
});
test("expired recovery token is rejected and institution profile roundtrips", async () => {
  const a = await account("expired@example.com");
  const profile = {
    institution: "دبیرستان دانش",
    instructor: "مدرس",
    faculty: "",
    department: "",
    year: "۱۴۰۵",
  };
  await a.put("/api/auth/profile").send(profile).expect(200);
  assert.deepEqual(
    (await a.get("/api/auth/me").expect(200)).body.profile,
    profile,
  );
  await a
    .post("/api/auth/recover")
    .send({ email: "expired@example.com" })
    .expect(200);
  await db
    .collection("users")
    .updateMany({}, { $set: { "tokens.$[].expires_at": new Date(0) } });
  const token = messages
    .filter((m) => m.to === "expired@example.com")
    .at(-1)
    .text.match(/token=([a-f0-9]+)/)[1];
  await a
    .post("/api/auth/token")
    .send({ token, kind: "reset", password: "new-password-789" })
    .expect(400);
});

test("saved revisions required for export and malformed documents rejected", async () => {
  const a = await account("revision-export@example.com");
  const e = (
    await a.post("/api/exams").send({ document: exampleExam() }).expect(201)
  ).body;
  await a
    .post("/api/exams/" + e.id + "/pdf")
    .send({ revision: 0, kind: "student" })
    .expect(409);
  await a
    .post("/api/exams/" + e.id + "/pdf")
    .send({ revision: 1, kind: "unknown" })
    .expect(422);
  const malicious = exampleExam();
  malicious.questions[0].body = { type: "script", content: [] };
  await a
    .put("/api/exams/" + e.id)
    .send({ revision: 1, document: malicious })
    .expect(422);
  assert.equal(
    (await a.get("/api/exams/" + e.id).expect(200)).body.revision,
    1,
  );
});

after(async () => {
  await client?.close();
  await mongo?.stop();
  await rm(assetDir, { recursive: true, force: true });
  delete process.env.ASSET_DIR;
});

test("uploaded raster assets remain private and unsupported formats are rejected", async () => {
  const a = await account("upload@example.com"),
    b = await account("other-upload@example.com");
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#203c56" },
  })
    .png()
    .toBuffer();
  const multipart = (buffer, name, type) =>
    Buffer.concat([
      Buffer.from(
        `--exam-boundary\r\nContent-Disposition: form-data; name="image"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`,
      ),
      buffer,
      Buffer.from("\r\n--exam-boundary--\r\n"),
    ]);
  const upload = (agent, buffer, name, type) =>
    agent
      .post("/api/assets")
      .set("content-type", "multipart/form-data; boundary=exam-boundary")
      .send(multipart(buffer, name, type));
  const result = await upload(a, png, "sample.png", "image/png").expect(201);
  const url = result.body.src;
  const image = await a.get(url).expect(200);
  assert.match(image.headers["content-type"], /image\/webp/);
  await b.get(url).expect(404);
  await request(app).get(url).expect(401);
  const e = exampleExam();
  e.meta.logo = url;
  await a.post("/api/exams").send({ document: e }).expect(201);
  await b.post("/api/exams").send({ document: e }).expect(422);
  await upload(
    a,
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    ),
    "bad.svg",
    "image/svg+xml",
  ).expect(422);
});

test("MongoDB rejects duplicate emails and concurrent revision writes", async () => {
  const a = await account("atomic@example.com");
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Duplicate",
      email: "ATOMIC@example.com",
      password: "password-12345",
    })
    .expect(409);
  const exam = (
    await a.post("/api/exams").send({ document: exampleExam() }).expect(201)
  ).body;
  assert.equal(exam._id, undefined);
  const writes = await Promise.all(
    [1, 2].map(() =>
      a
        .put("/api/exams/" + exam.id)
        .send({ revision: 1, document: exampleExam() })
        .expect(),
    ),
  );
  assert.deepEqual(writes.map((x) => x.status).sort(), [200, 409]);
  await a
    .put("/api/exams/" + exam.id)
    .send({ revision: { $gt: 0 }, document: exampleExam() })
    .expect(409);
  assert.equal(
    (await a.get("/api/exams/" + exam.id).expect(200)).body.revision,
    2,
  );
});
test("MongoDB reset token can only be consumed once under concurrency", async () => {
  const a = await account("atomic-token@example.com");
  await a
    .post("/api/auth/recover")
    .send({ email: "atomic-token@example.com" })
    .expect(200);
  const token = messages
    .filter((m) => m.to === "atomic-token@example.com")
    .at(-1)
    .text.match(/token=([a-f0-9]+)/)[1];
  const results = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post("/api/auth/token")
        .send({ token, kind: "reset", password: "new-password-456" })
        .expect(),
    ),
  );
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
  await a.get("/api/auth/me").expect(401);
});
test("sessions survive replacing the Express app and logout removes them", async () => {
  const a = await account("persistent-session@example.com");
  const login = await a
    .post("/api/auth/login")
    .send({
      email: "persistent-session@example.com",
      password: "password-12345",
    })
    .expect(200);
  const user = (await a.get("/api/auth/me").expect(200)).body;
  const session = (await db.collection("sessions").find().toArray()).find(
    (s) => JSON.parse(s.session).userId === user.id,
  );
  assert.ok(session);
  assert.ok(session.expires instanceof Date);
  const anotherApp = createApp(db, { test: true, mongoClient: client });
  await request(anotherApp)
    .get("/api/auth/me")
    .set(
      "Cookie",
      [login.headers["set-cookie"]]
        .flat()
        .find((cookie) => cookie.startsWith("exam.sid="))
        .split(";")[0],
    )
    .expect(200);
  await a.post("/api/auth/logout").expect(200);
  assert.equal(
    await db.collection("sessions").findOne({ _id: session._id }),
    null,
  );
});
