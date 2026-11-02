import { defineStore } from "pinia";
import { ref } from "vue";
import { newExam, exampleExam, uid } from "../../shared/exam.js";
export async function api(url, options = {}) {
  const response = await fetch("/api" + url, {
    credentials: "same-origin",
    ...options,
    headers:
      options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json", ...options.headers },
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {}
    throw Object.assign(
      new Error(data?.error || "ارتباط برقرار نشد. دوباره تلاش کنید."),
      { status: response.status },
    );
  }
  return response.headers.get("content-type")?.includes("application/pdf")
    ? response.blob()
    : response.json();
}
const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("azmoon-demo") || "[]");
  } catch {
    return [];
  }
};
export const useExams = defineStore("exams", () => {
  const user = ref(null),
    items = ref([]),
    ready = ref(false),
    notice = ref(""),
    storageError = ref(false);
  const persist = () => {
    try {
      localStorage.setItem("azmoon-demo", JSON.stringify(items.value));
      storageError.value = false;
    } catch {
      storageError.value = true;
      throw new Error("حافظه مرورگر پر است. آزمون ذخیره نشد.");
    }
  };
  async function init() {
    try {
      user.value = await api("/auth/me");
    } catch {
      user.value = null;
    }
    await refresh();
    ready.value = true;
  }
  async function refresh() {
    if (user.value) items.value = await api("/exams");
    else items.value = readLocal();
  }
  async function create(example = false, document) {
    let doc = document || (example ? exampleExam() : newExam());
    doc = JSON.parse(JSON.stringify(doc));
    delete doc.layout.target;
    if (!example && !document && user.value?.profile)
      Object.assign(doc.meta, user.value.profile);
    const row = user.value
      ? await api("/exams", { method: "POST", body: { document: doc } })
      : {
          id: uid(),
          document: doc,
          revision: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    items.value.unshift(row);
    if (!user.value) persist();
    return row;
  }
  async function get(id) {
    return user.value
      ? api("/exams/" + id)
      : readLocal().find((e) => e.id === id);
  }
  async function save(id, document, revision) {
    document = JSON.parse(JSON.stringify(document));
    delete document.layout.target;
    if (user.value) {
      const row = await api("/exams/" + id, {
        method: "PUT",
        body: { document, revision },
      });
      const i = items.value.findIndex((e) => e.id === id);
      if (i >= 0) items.value[i] = row;
      return row;
    }
    const current = readLocal();
    const index = current.findIndex((e) => e.id === id);
    if (index < 0) throw new Error("آزمون پیدا نشد.");
    if (current[index].revision !== revision)
      throw Object.assign(
        new Error(
          "نسخه دیگری از این آزمون ذخیره شده است. نسخه جدید را باز کنید یا یک کپی بسازید.",
        ),
        { status: 409 },
      );
    const row = {
      ...current[index],
      document: structuredClone(document),
      revision: revision + 1,
      updated_at: new Date().toISOString(),
    };
    current[index] = row;
    items.value = current;
    persist();
    return row;
  }
  async function remove(id) {
    if (user.value) await api("/exams/" + id, { method: "DELETE" });
    items.value = items.value.filter((e) => e.id !== id);
    if (!user.value) persist();
  }
  async function duplicate(item) {
    const doc = structuredClone(JSON.parse(JSON.stringify(item.document)));
    doc.meta.title = (doc.meta.title || "آزمون بدون عنوان") + " (کپی)";
    return create(false, doc);
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    user.value = null;
    await refresh();
  }
  return {
    user,
    items,
    ready,
    notice,
    storageError,
    init,
    refresh,
    create,
    get,
    save,
    remove,
    duplicate,
    logout,
  };
});
