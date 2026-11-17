import { questionRichBodies } from "@exam/shared/exam.js";
import { openDB } from "idb";
import {
  registerResource,
  clearResources,
  resourceUrl,
} from "@exam/shared/resources.js";
const copy = (value) => JSON.parse(JSON.stringify(value));
const key = (owner, id) => `${owner}:${id}`;
let database;
const db = () =>
  (database ||= openDB("azmoon-offline", 1, {
    upgrade(database) {
      for (const name of ["exams", "drafts", "resources", "accounts"])
        database.createObjectStore(name);
    },
  }));
export const contextOwner = () => localStorage.getItem("azmoon-offline-owner");
export async function rememberAccount(user, billing, fonts) {
  await (await db()).put("accounts", copy({ user, billing, fonts }), user.id);
  localStorage.setItem("azmoon-offline-owner", user.id);
}
export async function rememberedAccount() {
  const owner = contextOwner();
  return owner ? (await db()).get("accounts", owner) : null;
}
export async function localExams(owner) {
  return (await (await db()).getAll("exams"))
    .filter((row) => row.owner_id === owner)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}
export async function localExam(owner, id) {
  return (await db()).get("exams", key(owner, id));
}
export async function draft(owner, id) {
  return (await db()).get("drafts", key(owner, id));
}
export async function putDraft(owner, id, value) {
  await (
    await db()
  ).put("drafts", copy({ ...value, owner_id: owner, id }), key(owner, id));
}
export async function clearSavedDraft(owner, id, change) {
  const tx = (await db()).transaction("drafts", "readwrite");
  const value = await tx.store.get(key(owner, id));
  if (value?.change === change) await tx.store.delete(key(owner, id));
  await tx.done;
}
export async function clearDraft(owner, id) {
  await (await db()).delete("drafts", key(owner, id));
}
export async function pendingDrafts(owner) {
  return (await (await db()).getAll("drafts")).filter(
    (d) => d.owner_id === owner,
  );
}
export function documentResources(document) {
  const resources = new Set();
  const visit = (node) => {
    if (
      node?.type === "image" &&
      /^\/api\/assets\/[a-f0-9-]+$/.test(node.attrs?.src || "")
    )
      resources.add(node.attrs.src);
    node?.content?.forEach(visit);
  };
  document.questions.forEach((q) => {
    questionRichBodies(q).forEach(visit);
    for (const side of ["left", "right"])
      q.matching?.[side]?.forEach((item) => visit(item.body));
  });
  if (document.meta.logo?.startsWith("/api/assets/"))
    resources.add(document.meta.logo);
  if (/^[a-f0-9-]{36}$/.test(document.layout.fontFamily || ""))
    resources.add(`/api/fonts/${document.layout.fontFamily}/file`);
  return [...resources];
}
export async function hydrateResources(owner, document, api, download = true) {
  const database = await db(),
    missing = [];
  for (const source of documentResources(document)) {
    const id = key(owner, source);
    let blob = await database.get("resources", id);
    if (!blob && download) {
      try {
        blob = await api(source.slice(4), { blob: true });
        await database.put("resources", blob, id);
      } catch (error) {
        if (error.status === 401 || error.status === 403) throw error;
      }
    }
    if (blob && resourceUrl(source) === source)
      registerResource(source, URL.createObjectURL(blob));
    else if (!blob) missing.push(source);
  }
  return missing;
}
export async function cacheExam(owner, row, api) {
  const missing = await hydrateResources(owner, row.document, api);
  const value = {
    ...copy(row),
    owner_id: owner,
    offlineComplete: !missing.length,
    missingResources: missing,
  };
  await (await db()).put("exams", value, key(owner, row.id));
  return value;
}
export async function removeLocalExam(owner, id) {
  const database = await db();
  if (await draft(owner, id))
    throw new Error(
      "این آزمون تغییرات همگام‌نشده دارد؛ ابتدا آن‌ها را ذخیره کنید.",
    );
  await database.delete("exams", key(owner, id));
  // Shared blobs remain until account storage is cleared; other downloaded exams may reference them.
}
export async function clearAccount(owner) {
  const database = await db();
  const tx = database.transaction(
    ["exams", "drafts", "resources", "accounts"],
    "readwrite",
  );
  for (const name of ["exams", "drafts", "resources"]) {
    for (const id of await tx.objectStore(name).getAllKeys())
      if (String(id).startsWith(owner + ":"))
        await tx.objectStore(name).delete(id);
  }
  await tx.objectStore("accounts").delete(owner);
  await tx.done;
  if (contextOwner() === owner) localStorage.removeItem("azmoon-offline-owner");
  clearResources();
}
const queues = new Map();
export function serial(owner, id, action) {
  const idKey = key(owner, id);
  const promise = (queues.get(idKey) || Promise.resolve())
    .catch(() => {})
    .then(action);
  queues.set(idKey, promise);
  return promise.finally(() => {
    if (queues.get(idKey) === promise) queues.delete(idKey);
  });
}
export async function storageUsage() {
  return navigator.storage?.estimate?.() || {};
}
