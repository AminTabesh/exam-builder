import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { useExams } from "../src/stores/exams.js";
import { exampleExam } from "../shared/exam.js";
const originalFetch = globalThis.fetch;
let memory;
beforeEach(() => {
  setActivePinia(createPinia());
  memory = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
    },
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("guest saves persist exact content and reject another-tab changes", async () => {
  const store = useExams();
  const row = await store.create(true);
  const document = JSON.parse(JSON.stringify(row.document));
  document.meta.title = "تغییر محلی";
  const saved = await store.save(row.id, document, 1);
  assert.equal(saved.revision, 2);
  assert.equal((await store.get(row.id)).document.meta.title, "تغییر محلی");
  await assert.rejects(store.save(row.id, document, 1), { status: 409 });
  assert.equal((await store.get(row.id)).revision, 2);
});
test("failed account save leaves last saved revision intact and can be retried", async () => {
  const store = useExams();
  store.user = { id: "teacher" };
  const document = exampleExam();
  store.items = [
    { id: "exam", revision: 1, document: structuredClone(document) },
  ];
  document.meta.title = "پیش‌نویس بازیابی";
  let attempts = 0;
  globalThis.fetch = async (url, options) => {
    attempts++;
    if (attempts === 1) throw new TypeError("Network disconnected");
    const body = JSON.parse(options.body);
    assert.equal(body.revision, 1);
    return new Response(
      JSON.stringify({ id: "exam", revision: 2, document: body.document }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  await assert.rejects(store.save("exam", document, 1), /Network disconnected/);
  assert.equal(store.items[0].revision, 1);
  assert.equal(document.meta.title, "پیش‌نویس بازیابی");
  await store.save("exam", document, 1);
  assert.equal(store.items[0].revision, 2);
  assert.equal(store.items[0].document.meta.title, "پیش‌نویس بازیابی");
});
test("storage exhaustion does not report a successful guest save", async () => {
  const store = useExams();
  const row = await store.create(true);
  localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  await assert.rejects(store.save(row.id, exampleExam(), 1), /ذخیره نشد/);
  assert.equal(store.storageError, true);
  assert.equal(JSON.parse(memory.get("azmoon-demo"))[0].revision, 1);
});
