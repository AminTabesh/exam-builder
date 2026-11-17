import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { useExams } from "../apps/frontend/src/features/exams/store.js";
import { exampleExam } from "@exam/shared/exam.js";
let memory;
const originalFetch = globalThis.fetch;
beforeEach(() => {
  setActivePinia(createPinia());
  memory = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => memory.get(k) || null,
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    },
  });
});
afterEach(() => (globalThis.fetch = originalFetch));
test("unauthenticated stores cannot create, read, save or delete exams", async () => {
  const store = useExams();
  for (const fn of [
    () => store.create(),
    () => store.get("id"),
    () => store.save("id", exampleExam(), 1),
    () => store.remove("id"),
  ])
    await assert.rejects(fn(), { status: 401 });
});
test("failed saves preserve revision and retry submits the original revision", async () => {
  const store = useExams();
  store.user = { id: "teacher" };
  store.items = [{ id: "exam", revision: 1, document: exampleExam() }];
  let attempts = 0;
  globalThis.fetch = async (url, options) => {
    attempts++;
    if (attempts === 1) throw new TypeError("offline");
    const body = JSON.parse(options.body);
    assert.equal(body.revision, 1);
    return Response.json({ id: "exam", revision: 2, document: body.document });
  };
  await assert.rejects(store.save("exam", exampleExam(), 1));
  assert.equal(store.items[0].revision, 1);
  await store.save("exam", exampleExam(), 1);
  assert.equal(store.items[0].revision, 2);
});
test("legacy import is explicit and only successful imports remove local originals", async () => {
  const store = useExams(),
    rows = [
      { id: "one", document: exampleExam() },
      { id: "two", document: exampleExam() },
    ];
  localStorage.setItem("azmoon-demo", JSON.stringify(rows));
  store.user = { id: "teacher" };
  let creations = 0;
  globalThis.fetch = async (url, options) => {
    if (url === "/api/exams") {
      creations++;
      return creations === 1
        ? Response.json({ id: "new", document: exampleExam(), revision: 1 })
        : Response.json(
            { error: "quota", code: "EXAM_QUOTA" },
            { status: 402 },
          );
    }
    return Response.json({ plan: { id: "free" }, remaining: 0 });
  };
  assert.equal(JSON.parse(localStorage.getItem("azmoon-demo")).length, 2);
  await store.adoptGuestExams();
  assert.deepEqual(
    JSON.parse(localStorage.getItem("azmoon-demo")).map((r) => r.id),
    ["two"],
  );
  assert.equal(store.legacyCount, 1);
});
