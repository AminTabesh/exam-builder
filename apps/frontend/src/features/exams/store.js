import { defineStore } from "pinia";
import { ref } from "vue";
import { newExam, exampleExam } from "@exam/shared/exam.js";
import { api } from "../../platform/api.js";
import * as offline from "./offline.js";
export { api } from "../../platform/api.js";
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
    storageError = ref(false),
    billing = ref(null),
    fonts = ref([]),
    legacyCount = ref(0),
    offlineMode = ref(false),
    needsAuth = ref(false),
    downloaded = ref([]);
  let initialization;
  function init() {
    return (initialization ||= (async () => {
      try {
        user.value = await api("/auth/me");
      } catch (e) {
        const remembered = await offline.rememberedAccount().catch(() => null);
        if (remembered) {
          user.value = remembered.user;
          billing.value = remembered.billing;
          fonts.value = remembered.fonts;
          items.value = await offline.localExams(user.value.id);
          downloaded.value = items.value;
          offlineMode.value = true;
          needsAuth.value = e.status === 401;
          ready.value = true;
          return;
        }
        if (e.status !== 401) {
          initialization = null;
          throw e;
        }
        user.value = null;
      }
      if (user.value) {
        try {
          await refresh();
        } catch (error) {
          items.value = await offline.localExams(user.value.id);
          offlineMode.value = true;
          notice.value = "کتابخانه دستگاه باز شد؛ اتصال به سرور در دسترس نیست.";
        }
      }
      legacyCount.value = readLocal().length;
      ready.value = true;
    })());
  }
  async function refreshBilling() {
    billing.value = await api("/billing");
  }
  async function refresh() {
    if (!user.value) {
      items.value = [];
      billing.value = null;
      fonts.value = [];
      return;
    }
    const [exams, accountBilling, accountFonts] = await Promise.all([
      api("/exams"),
      api("/billing"),
      api("/fonts"),
    ]);
    items.value = exams;
    offlineMode.value = false;
    needsAuth.value = false;
    billing.value = accountBilling;
    fonts.value = accountFonts;
    legacyCount.value = readLocal().length;
    try {
      await offline.rememberAccount(user.value, billing.value, fonts.value);
      downloaded.value = await offline.localExams(user.value.id);
    } catch {
      storageError.value = true;
      notice.value = "ذخیره آفلاین در این دستگاه در دسترس نیست.";
    }
  }
  function requireUser() {
    if (!user.value)
      throw Object.assign(new Error("ابتدا وارد حساب شوید."), { status: 401 });
  }
  async function create(example = false, document, creationKey) {
    requireUser();
    let doc = JSON.parse(
      JSON.stringify(document || (example ? exampleExam() : newExam())),
    );
    doc = await (
      await import("./imageUpload.js")
    ).materializeAccountImages(doc);
    delete doc.layout.target;
    if (!example && !document && user.value.profile)
      Object.assign(doc.meta, user.value.profile);
    const row = await api("/exams", {
      method: "POST",
      body: { document: doc, creationKey },
    });
    if (!items.value.some((item) => item.id === row.id))
      items.value.unshift(row);
    await refreshBilling().catch(() => {
      notice.value = "آزمون ذخیره شد؛ تازه‌سازی سهمیه انجام نشد.";
    });
    return row;
  }
  async function adoptGuestExams() {
    requireUser();
    let imported = 0;
    for (const row of readLocal()) {
      try {
        await create(false, row.document, `legacy-${row.id}`);
        localStorage.setItem(
          "azmoon-demo",
          JSON.stringify(readLocal().filter((item) => item.id !== row.id)),
        );
        imported++;
      } catch (e) {
        notice.value = `${imported} آزمون منتقل شد. نسخه‌های باقی‌مانده محفوظ‌اند. ${e.message}`;
        legacyCount.value = readLocal().length;
        return;
      }
    }
    legacyCount.value = readLocal().length;
    notice.value = `${imported} آزمون به حساب منتقل شد.`;
  }
  async function get(id) {
    requireUser();
    try {
      const row = await api("/exams/" + id);
      try {
        const cached = await offline.cacheExam(user.value.id, row, api);
        downloaded.value = await offline.localExams(user.value.id);
        return cached;
      } catch {
        notice.value = "آزمون باز شد؛ ذخیره آفلاین کامل نشد.";
        return row;
      }
    } catch (error) {
      if (error.status && ![401, 502, 503, 504].includes(error.status))
        throw error;
      const row = await offline.localExam(user.value.id, id);
      if (!row)
        throw new Error(
          "این آزمون روی دستگاه دانلود نشده است. برای بازکردن آن به اینترنت وصل شوید.",
        );
      row.missingResources = await offline.hydrateResources(
        user.value.id,
        row.document,
        api,
        false,
      );
      row.offline = true;
      return row;
    }
  }
  async function save(id, document, revision) {
    requireUser();
    document = await (
      await import("./imageUpload.js")
    ).materializeAccountImages(JSON.parse(JSON.stringify(document)));
    delete document.layout.target;
    const row = await api("/exams/" + id, {
      method: "PUT",
      body: { document, revision },
    });
    const index = items.value.findIndex((item) => item.id === id);
    if (index >= 0) items.value[index] = row;
    await offline.cacheExam(user.value.id, row, api).catch(() => {
      notice.value = "نسخه سرور ذخیره شد؛ حافظه دستگاه را بررسی کنید.";
    });
    return row;
  }
  async function remove(id) {
    requireUser();
    await api("/exams/" + id, { method: "DELETE" });
    await offline.clearDraft(user.value.id, id);
    await offline.removeLocalExam(user.value.id, id);
    items.value = items.value.filter((item) => item.id !== id);
  }
  async function duplicate(item) {
    requireUser();
    const row = await api("/exams/" + item.id + "/duplicate", {
      method: "POST",
    });
    if (!items.value.some((item) => item.id === row.id))
      items.value.unshift(row);
    await refreshBilling().catch(() => {
      notice.value = "آزمون ذخیره شد؛ تازه‌سازی سهمیه انجام نشد.";
    });
    return row;
  }
  async function logout() {
    if (
      (await offline.pendingDrafts(user.value.id)).length &&
      !window.confirm(
        "تغییرات همگام‌نشده روی این دستگاه پاک می‌شوند. خارج می‌شوید؟",
      )
    )
      return false;
    const { native, setSession } = await import("../../platform/api.js");
    try {
      await api(native ? "/mobile/auth/logout" : "/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      if (navigator.onLine && error.status !== 401) throw error;
    }
    await setSession(null);
    await offline.clearAccount(user.value.id);
    for (const key of Object.keys(localStorage))
      if (key.startsWith(`azmoon-draft-${user.value.id}-`))
        localStorage.removeItem(key);
    offlineMode.value = false;
    needsAuth.value = false;
    user.value = null;
    downloaded.value = [];
    await refresh();
    return true;
  }
  async function downloadExam(item) {
    const row = await get(item.id);
    downloaded.value = await offline.localExams(user.value.id);
    notice.value = row.missingResources?.length
      ? "متن ذخیره شد؛ دانلود بعضی تصاویر یا فونت‌ها کامل نیست."
      : "آزمون برای کار آفلاین آماده است.";
  }
  async function forgetExam(item) {
    await offline.removeLocalExam(user.value.id, item.id);
    downloaded.value = await offline.localExams(user.value.id);
  }
  async function syncPending() {
    if (!user.value || !navigator.onLine) return;
    for (const entry of await offline.pendingDrafts(user.value.id)) {
      await offline.serial(user.value.id, entry.id, async () => {
        const current = await offline.draft(user.value.id, entry.id);
        if (!current || current.conflict) return;
        try {
          const row = await save(entry.id, current.document, current.revision);
          const latest = await offline.draft(user.value.id, entry.id);
          if (latest?.version === current.version) {
            await offline.clearDraft(user.value.id, entry.id);
            localStorage.removeItem(
              `azmoon-draft-${user.value.id}-${entry.id}`,
            );
          } else if (latest)
            await offline.putDraft(user.value.id, entry.id, {
              ...latest,
              revision: row.revision,
            });
        } catch (error) {
          if (error.status === 409)
            await offline.putDraft(user.value.id, entry.id, {
              ...current,
              conflict: true,
            });
          notice.value =
            error.status === 409
              ? "یک پیش‌نویس با نسخه سرور تداخل دارد؛ آزمون را برای بررسی باز کنید."
              : "پیش‌نویس‌ها روی دستگاه محفوظ‌اند؛ همگام‌سازی کامل نشد.";
        }
      });
    }
  }
  return {
    user,
    offlineMode,
    needsAuth,
    downloaded,
    downloadExam,
    forgetExam,
    syncPending,
    items,
    ready,
    notice,
    storageError,
    billing,
    fonts,
    legacyCount,
    init,
    refresh,
    refreshBilling,
    adoptGuestExams,
    create,
    get,
    save,
    remove,
    duplicate,
    logout,
  };
});
