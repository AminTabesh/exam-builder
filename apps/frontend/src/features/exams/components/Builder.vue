<script setup>
import { englishDigits, persianDigits } from "../../../lib/numbers.js";
import OptionEditor from "./OptionEditor.vue";
import MatchingEditor from "./MatchingEditor.vue";
import MathTextField from "./MathTextField.vue";
import AiGenerator from "./AiGenerator.vue";
import FontSettings from "../../account/components/FontSettings.vue";
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useOnline, useEventListener, useMediaQuery } from "@vueuse/core";
import * as offline from "../offline.js";
import { resourceUrl } from "@exam/shared/resources.js";
import { savePdf } from "../../../platform/runtime.js";
import { useExams, api } from "../store.js";
import {
  newQuestion,
  questionRichBodies,
  optionEmpty,
  total,
  count,
  digits,
  hundredths,
  plain,
  validateForExport,
  uid,
  printStyles,
} from "@exam/shared/exam";
import { uploadImage } from "../imageUpload.js";
import DateField from "../../../components/DateField.vue";
import Icon from "../../../components/Icon.vue";
import RichEditor from "./RichEditor.vue";
import PaperPreview from "./PaperPreview.vue";
const route = useRoute(),
  router = useRouter(),
  store = useExams(),
  online = useOnline(),
  exam = ref(null),
  revision = ref(1),
  step = ref(1),
  selectedQuestion = ref(0),
  saveState = ref("saved"),
  error = ref(""),
  validation = ref(false),
  previewError = ref(""),
  mobilePreview = ref(true),
  previewDialog = ref(false),
  pages = ref(1),
  draggedQuestion = ref(null),
  deleted = ref(null),
  exporting = ref(false),
  pdfUrl = ref(""),
  pdfKind = ref("student"),
  pdfDialog = ref(false),
  conflict = ref(false);
const phone = useMediaQuery("(max-width: 767px)");
const outlineDialog = ref(false),
  addDialog = ref(false);
const activeQuestions = computed(
  () =>
    exam.value?.questions
      .map((q, index) => ({ q, index }))
      .filter(({ index }) => index === selectedQuestion.value) || [],
);
const templateMode = ref("monochrome");
let localWrite = Promise.resolve();
const pdfBlob = ref(null);
watch(
  () => exam.value?.layout.style,
  (id) => {
    templateMode.value =
      printStyles.find((style) => style.id === id)?.mode || "monochrome";
  },
);
const logoUploading = ref(false);
async function handleLogo(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  logoUploading.value = true;
  error.value = "";
  try {
    exam.value.meta.logo = await uploadImage(file, store.user);
  } catch (cause) {
    error.value = cause.message;
  } finally {
    logoUploading.value = false;
    event.target.value = "";
  }
}
let timer,
  saving = null,
  change = 0,
  savedChange = 0,
  hydrating = true,
  cacheOk = true;
const id = route.params.id,
  draftKey = () => `azmoon-draft-${store.user?.id || "guest"}-${id}`;
const steps = ["مشخصات آزمون", "افزودن سؤال‌ها", "بازبینی و دریافت PDF"];
const types = [
  { id: "mcq", label: "چندگزینه‌ای", description: "یک پاسخ از میان گزینه‌ها" },
  { id: "blank", label: "جای خالی", description: "تکمیل عبارت یا جمله" },
  { id: "written", label: "تشریحی", description: "پاسخ کوتاه یا راه‌حل کامل" },
  { id: "matching", label: "وصل‌کردنی", description: "اتصال موارد دو ستون" },
];
const sum = computed(() => (exam.value ? total(exam.value) : 0)),
  issues = computed(() => (exam.value ? validateForExport(exam.value) : [])),
  saveLabel = computed(
    () =>
      ({
        saved: store.user ? "همه تغییرات ذخیره شد" : "ذخیره‌شده در این مرورگر",
        saving: "در حال ذخیره…",
        pending: "در انتظار ذخیره",
        offline: "آفلاین؛ ذخیره روی دستگاه",
        error: "ذخیره انجام نشد",
        conflict: "تداخل با نسخه دیگر",
      })[saveState.value],
  );
function scoreError(value) {
  try {
    hundredths(value);
    return "";
  } catch {
    return "نمره مثبت با حداکثر دو رقم اعشار بنویسید.";
  }
}
function bodyError(q) {
  if (
    !plain(q.body).trim() &&
    !JSON.stringify(q.body).includes('"image"') &&
    !JSON.stringify(q.body).includes('"formula"') &&
    !JSON.stringify(q.body).includes('"drawing"') &&
    !JSON.stringify(q.body).includes('"parabola"')
  )
    return "متن این سؤال را بنویسید.";
  if (q.type === "blank" && !JSON.stringify(q.body).includes('"blank"'))
    return "با دکمه درج جای خالی، محل پاسخ را مشخص کنید.";
  return "";
}
function cache() {
  const value = JSON.parse(
    JSON.stringify({
      document: exam.value,
      revision: revision.value,
      change,
      conflict: conflict.value,
      version: crypto.randomUUID(),
    }),
  );
  // A synchronous emergency copy also protects abrupt WebView process termination.
  try {
    localStorage.setItem(draftKey(), JSON.stringify(value));
  } catch {
    /* IndexedDB remains the durable store. */
  }
  localWrite = localWrite
    .catch(() => {})
    .then(async () => {
      await offline.putDraft(store.user.id, id, value);
      cacheOk = true;
      if (!online.value && !conflict.value) saveState.value = "offline";
    })
    .catch(() => {
      cacheOk = false;
      saveState.value = "error";
      error.value = "حافظه دستگاه پر است. تا ذخیره موفق، این صفحه را نبندید.";
    });
  return localWrite;
}
async function save() {
  clearTimeout(timer);
  if (!exam.value || conflict.value) return false;
  if (saving) {
    await saving;
    if (savedChange < change) return save();
    return saveState.value === "saved";
  }
  if (savedChange === change) return true;
  if (!online.value && store.user) {
    saveState.value = "pending";
    await cache();
    return false;
  }
  const snapshot = JSON.parse(JSON.stringify(exam.value)),
    version = change;
  saveState.value = "saving";
  saving = (async () => {
    try {
      const result = await offline.serial(store.user.id, id, () =>
        store.save(id, snapshot, revision.value),
      );
      revision.value = result.revision;
      savedChange = version;
      saveState.value = version === change ? "saved" : "pending";
      if (version === change) {
        // Update only uploaded image references. Replacing the document here interrupts
        // in-progress editor selections, resize gestures and open authoring dialogs.
        const refs = new Map();
        function collect(before, after) {
          if (
            before?.type === "image" &&
            before.attrs?.src?.startsWith("data:") &&
            after?.attrs?.src?.startsWith("/api/assets/")
          )
            refs.set(before.attrs.src, after.attrs.src);
          before?.content?.forEach((node, index) =>
            collect(node, after?.content?.[index]),
          );
        }
        snapshot.questions.forEach((q, index) => {
          const remote = result.document.questions[index];
          questionRichBodies(q).forEach((body, i) =>
            collect(body, remote && questionRichBodies(remote)[i]),
          );
          for (const side of ["left", "right"])
            q.matching?.[side]?.forEach((item, i) =>
              collect(item.body, remote?.matching?.[side]?.[i]?.body),
            );
        });
        if (snapshot.meta.logo?.startsWith("data:"))
          refs.set(snapshot.meta.logo, result.document.meta.logo);
        if (refs.size) {
          hydrating = true;
          function replace(node) {
            if (refs.has(node?.attrs?.src))
              node.attrs.src = refs.get(node.attrs.src);
            node?.content?.forEach(replace);
          }
          exam.value.questions.forEach((q) => {
            questionRichBodies(q).forEach(replace);
            for (const side of ["left", "right"])
              q.matching?.[side]?.forEach((item) => replace(item.body));
          });
          if (refs.has(exam.value.meta.logo))
            exam.value.meta.logo = refs.get(exam.value.meta.logo);
          await nextTick();
          hydrating = false;
        }
        await localWrite;
        await offline.clearSavedDraft(store.user.id, id, version);
        if (version === change) localStorage.removeItem(draftKey());
        else await cache();
      } else await cache();
      error.value = "";
      return true;
    } catch (e) {
      error.value = e.message;
      saveState.value = e.status === 409 ? "conflict" : "error";
      conflict.value = e.status === 409;
      await cache();
      return false;
    } finally {
      saving = null;
    }
  })();
  return saving;
}
watch(
  exam,
  () => {
    if (hydrating) return;
    change++;
    cache();
    if (!conflict.value) saveState.value = "pending";
    clearTimeout(timer);
    timer = setTimeout(save, 750);
  },
  { deep: true },
);
watch(online, (value) => {
  if (value) save();
});
async function load() {
  hydrating = true;
  try {
    const row = await store.get(id);
    if (!row) throw new Error("آزمون پیدا نشد. به کتابخانه برگردید.");
    exam.value = row.document;
    delete exam.value.layout.target;
    revision.value = row.revision;
    let pending = await offline.draft(store.user.id, id).catch(() => null);
    if (!pending) {
      try {
        pending = JSON.parse(localStorage.getItem(draftKey()) || "null");
      } catch {
        /* Corrupt legacy copy does not block the saved exam. */
      }
    }
    if (row.offline) saveState.value = "offline";
    if (row.missingResources?.length)
      error.value =
        "بعضی تصاویر یا فونت‌ها دانلود نشده‌اند؛ متن و ویرایش آزمون در دسترس است.";
    if (pending) {
      exam.value = pending.document;
      delete exam.value.layout.target;
      change = pending.change || 1;
      await offline.hydrateResources(
        store.user.id,
        pending.document,
        api,
        !row.offline,
      );
      if (pending.conflict || pending.revision !== row.revision) {
        conflict.value = true;
        saveState.value = "conflict";
        error.value =
          "نسخه ذخیره‌شده با پیش‌نویس این دستگاه متفاوت است. برای نگه‌داشتن تغییرات، یک کپی بسازید.";
      } else {
        saveState.value = "pending";
        store.notice = "تغییرات ذخیره‌نشده بازیابی شد.";
      }
    }
    if (pending && !conflict.value) await cache();
    await nextTick();
  } catch (e) {
    error.value = e.message;
  } finally {
    hydrating = false;
    if (change && !conflict.value) save();
  }
}
async function reload() {
  if (
    !window.confirm("تغییرات این دستگاه کنار گذاشته و نسخه سرور بارگذاری شود؟")
  )
    return;
  if (!online.value) {
    error.value = "برای بارگذاری نسخه سرور به اینترنت وصل شوید.";
    return;
  }
  await localWrite;
  await offline.clearDraft(store.user.id, id);
  localStorage.removeItem(draftKey());
  conflict.value = false;
  change = 0;
  savedChange = 0;
  await load();
  saveState.value = "saved";
  error.value = "";
}
async function copyConflict() {
  try {
    const row = await store.create(
      false,
      JSON.parse(JSON.stringify(exam.value)),
    );
    await localWrite;
    await offline.clearDraft(store.user.id, id);
    localStorage.removeItem(draftKey());
    conflict.value = false;
    savedChange = change;
    await router.push("/exam/" + row.id);
  } catch (e) {
    error.value = e.message;
  }
}
function add(type) {
  addDialog.value = false;
  exam.value.questions.push(newQuestion(type));
  selectedQuestion.value = exam.value.questions.length - 1;
  nextTick(() => {
    if (!phone.value) document.querySelector(".question-card .tiptap")?.focus();
  });
}
function move(index, delta) {
  const [q] = exam.value.questions.splice(index, 1);
  exam.value.questions.splice(index + delta, 0, q);
  selectedQuestion.value = index + delta;
}
function duplicate(index) {
  const q = JSON.parse(JSON.stringify(exam.value.questions[index]));
  q.id = uid();
  exam.value.questions.splice(index + 1, 0, q);
  selectedQuestion.value = index + 1;
}
function remove(index) {
  deleted.value = { question: exam.value.questions[index], index };
  exam.value.questions.splice(index, 1);
  selectedQuestion.value = Math.max(
    0,
    Math.min(selectedQuestion.value, exam.value.questions.length - 1),
  );
}
function undo() {
  if (deleted.value) {
    exam.value.questions.splice(deleted.value.index, 0, deleted.value.question);
    deleted.value = null;
  }
}
async function exportPdf(kind) {
  if (exporting.value) return;
  validation.value = true;
  if (issues.value.length || previewError.value) return;
  exporting.value = true;
  error.value = "";
  pdfKind.value = kind;
  try {
    if (!(await save())) throw new Error("ابتدا ذخیره آزمون را کامل کنید.");
    const blob = await api("/exams/" + id + "/pdf", {
      method: "POST",
      body: { revision: revision.value, kind },
    });
    if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
    pdfBlob.value = blob;
    pdfUrl.value = URL.createObjectURL(blob);
    pdfDialog.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    exporting.value = false;
  }
}
async function download(share = false) {
  try {
    await savePdf(
      pdfBlob.value,
      (exam.value.meta.title || "exam") +
        (pdfKind.value === "answer-key" ? " - پاسخ‌نامه" : "") +
        ".pdf",
      share,
    );
  } catch (cause) {
    error.value = cause.message;
  }
}
useEventListener(document, "visibilitychange", () => {
  if (document.visibilityState === "hidden" && change > savedChange) cache();
});
useEventListener(window, "app-foreground", () => {
  if (online.value && change > savedChange) save();
});
useEventListener(window, "app-background", () => {
  if (change > savedChange) cache();
});
useEventListener(window, "beforeunload", (event) => {
  if (change > savedChange) {
    cache();
    event.preventDefault();
    event.returnValue = "";
  }
});
onBeforeRouteLeave(async () => {
  const ok = await save();
  await localWrite;
  if (!ok && !cacheOk) {
    error.value = "ذخیره آزمون انجام نشد. پیش از خروج، دوباره ذخیره کنید.";
    return false;
  }
  return true;
});
onMounted(load);
onBeforeUnmount(() => {
  clearTimeout(timer);
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
});
</script>
<template>
  <div v-if="exam" class="builder production-studio">
    <div class="builder-heading">
      <div>
        <router-link to="/dashboard" class="back-link"
          ><Icon name="right" :size="17" /> آزمون‌های من</router-link
        >
        <h1>{{ exam.meta.title || "ساخت آزمون جدید" }}</h1>
      </div>
      <div class="save-status" aria-live="polite">
        <Icon :name="saveState === 'saved' ? 'saved' : 'file'" :size="18" />{{
          saveLabel
        }}<v-btn
          v-if="['error', 'offline'].includes(saveState)"
          variant="text"
          size="small"
          @click="save"
          >تلاش دوباره</v-btn
        >
      </div>
    </div>
    <nav class="studio-navigation" aria-label="بخش‌های استودیو">
      <button :aria-pressed="step === 1" @click="step = 1">
        <span aria-hidden="true">۱ · </span>مشخصات و قالب برگه</button
      ><button :aria-pressed="step === 2" @click="step = 2">
        <span aria-hidden="true">۲ · </span>سؤال‌ها و ویرایش</button
      ><button :aria-pressed="step === 3" @click="step = 3">
        <span aria-hidden="true">۳ · </span>بازبینی و دریافت PDF
      </button>
    </nav>
    <v-alert v-if="error" type="error" class="tw-mb-4"
      >{{ error }}
      <div v-if="conflict" class="tw-mt-3">
        <v-btn @click="copyConflict">ساخت کپی از تغییرات من</v-btn
        ><v-btn variant="text" @click="reload">بارگذاری نسخه ذخیره‌شده</v-btn>
      </div></v-alert
    >
    <div class="studio-layout">
      <aside v-if="step === 2 && !phone" class="studio-outline">
        <div class="studio-outline-heading">
          <b>ساختار آزمون</b><span>{{ digits(exam.questions.length) }}</span>
        </div>
        <button
          v-for="(q, index) in exam.questions"
          :key="q.id"
          :aria-current="selectedQuestion === index ? 'true' : undefined"
          draggable="true"
          @dragstart="draggedQuestion = index"
          @dragend="draggedQuestion = null"
          @dragover.prevent
          @drop.prevent="
            draggedQuestion !== null &&
            move(draggedQuestion, index - draggedQuestion)
          "
          @click="selectedQuestion = index"
        >
          <span>{{ digits(index + 1) }}</span>
          <div>
            <b>{{ plain(q.body).slice(0, 45) || "سؤال جدید" }}</b
            ><small
              >{{ types.find((t) => t.id === q.type)?.label || "عنوان بخش" }} ·
              {{ digits(q.marks) }} نمره</small
            >
          </div></button
        ><button class="studio-add" @click="add('written')">
          <Icon name="plus" :size="18" /> افزودن سؤال تشریحی
        </button>
      </aside>
      <div
        class="builder-columns"
        :class="{ 'preview-collapsed': !mobilePreview }"
      >
        <div class="preview-layout-controls">
          <v-btn
            variant="text"
            :aria-expanded="mobilePreview"
            aria-controls="exam-preview-content"
            @click="mobilePreview = !mobilePreview"
            >{{ mobilePreview ? "بستن پیش‌نمایش" : "نمایش پیش‌نمایش" }}</v-btn
          >
        </div>
        <aside
          v-if="!phone"
          class="preview-column"
          :aria-hidden="!mobilePreview"
          :inert="!mobilePreview"
        >
          <div class="preview-heading">
            <div><Icon name="eye" :size="19" /><b>پیش‌نمایش برگه</b></div>
            <span>A4 · {{ digits(pages) }} صفحه</span>
          </div>
          <div id="exam-preview-content" class="preview-canvas">
            <PaperPreview
              :exam="exam"
              @pages="pages = $event"
              @error="previewError = $event"
            />
          </div>
          <div class="preview-caption">
            <span class="status-dot"></span>با تغییر اطلاعات، برگه به‌روز
            می‌شود.
          </div>
        </aside>
        <section class="editor-column">
          <div v-if="step === 1" class="form-panel">
            <div class="panel-heading">
              <span class="section-number">۰۱</span>
              <div>
                <h2>از مشخصات آزمون شروع کنیم</h2>
                <p>
                  فقط عنوان و نام درس ضروری است؛ بقیه را هر زمان خواستید کامل
                  کنید.
                </p>
              </div>
            </div>
            <div class="template-picker">
              <button
                v-for="t in [
                  {
                    id: 'school',
                    label: 'آزمون مدرسه',
                    detail: 'دبستان و دبیرستان',
                    icon: 'school',
                  },
                  {
                    id: 'university',
                    label: 'آزمون دانشگاه',
                    detail: 'دانشگاه و مؤسسه',
                    icon: 'book',
                  },
                ]"
                :key="t.id"
                :class="{ selected: exam.layout.template === t.id }"
                @click="exam.layout.template = t.id"
              >
                <Icon :name="t.icon" :size="25" />
                <div>
                  <b>{{ t.label }}</b
                  ><small>{{ t.detail }}</small>
                </div>
                <span class="radio-dot"></span>
              </button>
            </div>
            <div class="style-gallery-heading">
              <h3>قالب برگه</h3>
              <p>
                چیدمان دلخواه را انتخاب کنید؛ پیش‌نمایش همان لحظه به‌روز می‌شود.
              </p>
            </div>
            <div
              class="template-mode-switch"
              role="group"
              aria-label="نوع قالب"
            >
              <button
                v-for="mode in [
                  { id: 'monochrome', label: 'سیاه و سفید' },
                  { id: 'colorful', label: 'رنگی' },
                ]"
                :key="mode.id"
                type="button"
                :aria-pressed="templateMode === mode.id"
                @click="templateMode = mode.id"
              >
                {{ mode.label
                }}<span>{{
                  printStyles
                    .filter((style) => style.mode === mode.id)
                    .length.toLocaleString("fa-IR")
                }}</span>
              </button>
            </div>
            <div class="style-gallery" role="group" aria-label="قالب چاپ آزمون">
              <button
                v-for="style in printStyles.filter(
                  (style) => style.mode === templateMode,
                )"
                :key="style.id"
                :style="{ '--template-accent': style.accent || '#283241' }"
                type="button"
                :class="[
                  'style-choice',
                  `style-choice-${style.id}`,
                  { selected: (exam.layout.style || 'formal') === style.id },
                ]"
                :aria-pressed="(exam.layout.style || 'formal') === style.id"
                @click="exam.layout.style = style.id"
              >
                <span class="style-thumbnail" aria-hidden="true"
                  ><i></i><i></i><i></i><i></i
                ></span>
                <strong>{{ style.label }}</strong
                ><small>{{ style.detail }}</small>
              </button>
            </div>
            <v-text-field
              v-model="exam.meta.title"
              label="عنوان آزمون *"
              placeholder="مثلاً آزمون میان‌ترم ریاضی"
              :error-messages="
                validation && !exam.meta.title.trim()
                  ? 'عنوان آزمون را بنویسید.'
                  : ''
              "
            />
            <div class="form-grid">
              <v-text-field
                v-model="exam.meta.course"
                label="نام درس *"
                :error-messages="
                  validation && !exam.meta.course.trim()
                    ? 'نام درس را بنویسید.'
                    : ''
                "
              /><v-text-field
                v-model="exam.meta.instructor"
                label="نام مدرس"
              /><v-text-field
                v-model="exam.meta.duration"
                label="مدت آزمون (دقیقه)"
                inputmode="numeric"
              /><v-select
                v-model="exam.layout.language"
                label="زبان برگه"
                :items="[
                  { title: 'فارسی', value: 'fa' },
                  { title: 'English', value: 'en' },
                ]"
                @update:model-value="changeLanguage"
              />
            </div>
            <p class="field-hint">
              زبان برگه، جهت و برچسب‌ها را تغییر می‌دهد؛ متن سؤال‌ها ترجمه
              نمی‌شود.
            </p>
            <details :open="!phone">
              <summary>مشخصات آموزشی و زمان آزمون <span>اختیاری</span></summary>
              <div class="details-content">
                <v-text-field
                  v-model="exam.meta.institution"
                  label="نام مدرسه یا مؤسسه"
                />
                <div class="form-grid">
                  <template v-if="exam.layout.template === 'school'"
                    ><v-text-field
                      v-model="exam.meta.grade"
                      label="پایه تحصیلی" /><v-text-field
                      v-model="exam.meta.field"
                      label="رشته تحصیلی" /></template
                  ><template v-else
                    ><v-text-field
                      v-model="exam.meta.faculty"
                      label="دانشکده" /><v-text-field
                      v-model="exam.meta.department"
                      label="گروه آموزشی" /><v-text-field
                      v-model="exam.meta.courseCode"
                      label="کد درس" /><v-text-field
                      v-model="exam.meta.semester"
                      label="نیمسال" /></template
                  ><v-text-field
                    v-model="exam.meta.year"
                    label="سال تحصیلی"
                  /><v-select
                    v-model="exam.meta.calendar"
                    label="تقویم"
                    :items="[
                      { title: 'شمسی', value: 'jalali' },
                      { title: 'میلادی', value: 'gregorian' },
                    ]"
                  /><DateField
                    v-model="exam.meta.date"
                    :calendar="exam.meta.calendar"
                  /><v-text-field
                    v-model="exam.meta.startTime"
                    label="ساعت شروع"
                    placeholder="۰۹:۰۰"
                  />
                </div>
              </div>
            </details>
            <details>
              <summary>سربرگ و تنظیمات برگه <span>اختیاری</span></summary>
              <div class="details-content">
                <v-text-field
                  v-model="exam.meta.opening"
                  label="عبارت آغازین"
                /><v-textarea
                  v-model="exam.meta.instructions"
                  class="instructions-input"
                  :style="{
                    '--instructions-align':
                      exam.meta.instructionsAlign || 'center',
                  }"
                  label="راهنمای ابتدای آزمون"
                  hide-details
                  rows="2"
                  auto-grow
                  no-resize
                />
                <div
                  class="instructions-alignment"
                  role="group"
                  aria-label="تراز راهنمای ابتدای آزمون"
                >
                  <button
                    v-for="option in [
                      { value: 'right', label: 'راست‌چین' },
                      { value: 'center', label: 'وسط‌چین' },
                      { value: 'left', label: 'چپ‌چین' },
                    ]"
                    :key="option.value"
                    type="button"
                    :aria-label="option.label"
                    :title="option.label"
                    :aria-pressed="
                      (exam.meta.instructionsAlign || 'center') === option.value
                    "
                    @click="exam.meta.instructionsAlign = option.value"
                  >
                    <Icon :name="`align-${option.value}`" :size="20" />
                  </button>
                </div>
                <v-text-field
                  v-model="exam.meta.closing"
                  label="پیام پایان آزمون"
                />
                <div class="paper-font-grid">
                  <FontSettings
                    v-model="exam.layout.fontFamily"
                    @update:model-value="
                      (font) => {
                        if (font === 'b-nazanin') exam.layout.fontSize = 14;
                      }
                    "
                  />
                  <v-select
                    v-model="exam.layout.fontSize"
                    label="اندازه فونت برگه"
                    :items="[10, 11, 12, 13, 14, 15, 16]"
                  />
                </div>
                <v-checkbox
                  v-model="exam.meta.awardedScore"
                  label="نمایش کادر نمره کسب‌شده"
                /><label class="logo-upload"
                  >نشان مؤسسه (اختیاری)<input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    :disabled="logoUploading"
                    @change="handleLogo"
                /></label>
                <p v-if="logoUploading" role="status" class="field-hint">
                  در حال آماده‌سازی نشان…
                </p>
                <img
                  v-if="exam.meta.logo"
                  class="logo-preview"
                  :src="resourceUrl(exam.meta.logo)"
                  alt="پیش‌نمایش نشان مؤسسه"
                />
                <v-select
                  v-if="exam.meta.logo"
                  :model-value="exam.meta.logoPosition || 'right'"
                  @update:model-value="exam.meta.logoPosition = $event"
                  label="جای نشان مؤسسه"
                  :items="[
                    { title: 'گوشه بالا راست', value: 'right' },
                    { title: 'گوشه بالا چپ', value: 'left' },
                  ]"
                />
                <v-btn
                  v-if="exam.meta.logo"
                  variant="text"
                  @click="exam.meta.logo = ''"
                  >حذف نشان</v-btn
                >
              </div>
            </details>
          </div>
          <div v-show="step === 2" class="questions-panel">
            <div class="panel-heading">
              <span class="section-number">۰۲</span>
              <div>
                <h2>حالا نوبت سؤال‌هاست</h2>
                <p>نوع سؤال را انتخاب کنید و متن آن را بنویسید.</p>
              </div>
            </div>
            <AiGenerator
              :exam="exam"
              :disabled="conflict || !online"
              @insert="(questions) => exam.questions.push(...questions)"
            />
            <template v-if="step === 2">
              <div v-if="!phone" class="question-type-grid">
                <button
                  v-for="type in types"
                  :key="type.id"
                  @click="add(type.id)"
                >
                  <Icon :name="type.id" :size="25" /><b>{{ type.label }}</b
                  ><small>{{ type.description }}</small
                  ><span>＋ افزودن</span>
                </button>
              </div>
              <nav
                v-if="phone"
                class="mobile-question-navigation"
                aria-label="ناوبری سؤال‌ها"
              >
                <button
                  :disabled="selectedQuestion === 0"
                  @click="selectedQuestion--"
                  aria-label="سؤال قبل"
                >
                  <Icon name="right" />
                </button>
                <button @click="outlineDialog = true" aria-haspopup="dialog">
                  {{
                    exam.questions.length
                      ? `سؤال ${digits(selectedQuestion + 1)} از ${digits(exam.questions.length)}`
                      : "ساختار آزمون"
                  }}
                  <Icon name="down" :size="18" />
                </button>
                <button
                  :disabled="selectedQuestion >= exam.questions.length - 1"
                  @click="selectedQuestion++"
                  aria-label="سؤال بعد"
                >
                  <Icon name="left" />
                </button>
                <v-btn
                  color="primary"
                  icon
                  aria-label="افزودن"
                  @click="addDialog = true"
                  aria-haspopup="dialog"
                  ><Icon name="plus" :size="18" /></v-btn
                >
              </nav>
              <div v-if="!exam.questions.length" class="question-empty">
                اولین سؤال را از کارت‌های بالا اضافه کنید.
              </div>
              <div>
                <article
                  v-for="{ q, index } in activeQuestions"
                  :key="q.id"
                  class="question-card"
                >
                  <div class="question-card-header">
                    <button
                      class="drag-handle icon-button"
                      aria-label="گرفتن و جابه‌جایی سؤال"
                      tabindex="-1"
                    >
                      <Icon name="drag" /></button
                    ><b>{{
                      q.type === "section"
                        ? "عنوان بخش"
                        : "سؤال " +
                          digits(
                            exam.questions
                              .slice(0, index + 1)
                              .filter((x) => x.type !== "section").length,
                          )
                    }}</b
                    ><span class="question-type-label">{{
                      types.find((t) => t.id === q.type)?.label
                    }}</span>
                    <div class="question-actions">
                      <button
                        class="icon-button"
                        :disabled="index === 0"
                        aria-label="انتقال به بالا"
                        @click="move(index, -1)"
                      >
                        <Icon name="up" :size="19" /></button
                      ><button
                        class="icon-button"
                        :disabled="index === exam.questions.length - 1"
                        aria-label="انتقال به پایین"
                        @click="move(index, 1)"
                      >
                        <Icon name="down" :size="19" /></button
                      ><button
                        class="icon-button"
                        aria-label="کپی سؤال"
                        @click="duplicate(index)"
                      >
                        <Icon name="copy" :size="18" /></button
                      ><button
                        class="icon-button"
                        aria-label="حذف سؤال"
                        @click="remove(index)"
                      >
                        <Icon name="trash" :size="18" />
                      </button>
                    </div>
                  </div>
                  <RichEditor
                    v-model="q.body"
                    :label="q.type === 'section' ? 'عنوان بخش' : 'متن سؤال'"
                    :allow-blank="q.type !== 'section'"
                  />
                  <p
                    v-if="validation && bodyError(q)"
                    class="field-error"
                    role="alert"
                  >
                    {{ bodyError(q) }}
                  </p>
                  <MatchingEditor
                    v-if="q.type === 'matching'"
                    v-model="q.matching"
                    :language="exam.layout.language"
                  />
                  <div v-if="q.type === 'mcq'" class="options-editor">
                    <div v-for="(option, i) in q.options" :key="i">
                      <span class="option-number">{{ digits(i + 1) }}</span
                      ><OptionEditor
                        v-model="q.options[i]"
                        :label="'گزینه ' + digits(i + 1)"
                        :hide-details="!validation"
                        :error-messages="
                          validation && optionEmpty(q.options[i])
                            ? 'متن گزینه را بنویسید.'
                            : ''
                        "
                        density="compact"
                      /><button
                        v-if="q.options.length > 2"
                        class="icon-button"
                        :aria-label="'حذف گزینه ' + digits(i + 1)"
                        @click="q.options.splice(i, 1)"
                      >
                        <Icon name="close" :size="17" />
                      </button>
                    </div>
                    <v-btn
                      v-if="q.options.length < 6"
                      variant="text"
                      size="small"
                      @click="q.options.push('')"
                      >＋ افزودن گزینه</v-btn
                    >
                  </div>
                  <div v-if="q.type !== 'section'" class="question-settings">
                    <v-text-field
                      :model-value="persianDigits(q.marks)"
                      @update:model-value="
                        q.marks = englishDigits($event).replace('٫', '.')
                      "
                      label="نمره سؤال"
                      inputmode="decimal"
                      :error-messages="scoreError(q.marks)"
                      :hide-details="!scoreError(q.marks)"
                      density="compact"
                    /><template v-if="q.type === 'written'"
                      ><v-select
                        v-model="q.lines"
                        label="سطر پاسخ"
                        :items="
                          [0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50].map(
                            (value) => ({ title: persianDigits(value), value }),
                          )
                        "
                        hide-details
                        density="compact"
                    /></template>
                  </div>
                  <div v-if="q.type !== 'section'" class="answer-space-control">
                    <label
                      >فضای پاسخ اضافه
                      <input
                        :value="persianDigits(q.answerSpace)"
                        @input="
                          q.answerSpace =
                            Number(englishDigits($event.target.value)) || 0
                        "
                        inputmode="numeric"
                        min="0"
                        max="50"
                        @change="
                          q.answerSpace = Math.max(
                            0,
                            Math.min(50, Number(q.answerSpace) || 0),
                          )
                        "
                      />
                      سطر
                    </label>
                    <small
                      >برای هر نوع سؤال؛ خط‌دار یا خالی با تنظیم
                      «خط‌دار».</small
                    >
                    <label
                      ><input v-model="q.lined" type="checkbox" /> خط‌دار</label
                    >
                  </div>
                  <details>
                    <summary>پاسخ‌نامه و صفحه‌بندی</summary>
                    <div class="details-content">
                      <MathTextField
                        multiline
                        maxlength="4000"
                        v-if="q.type !== 'section'"
                        v-model="q.answer"
                        label="پاسخ صحیح یا راهنمای تصحیح"
                        hint="فقط در پاسخ‌نامه مدرس چاپ می‌شود."
                        persistent-hint
                        rows="2"
                      /><v-checkbox
                        v-model="q.pageBreak"
                        label="این سؤال از صفحه تازه شروع شود"
                      />
                    </div>
                  </details>
                </article>
              </div>
              <v-btn variant="text" @click="add('section')"
                >＋ افزودن عنوان بخش</v-btn
              ><v-alert
                v-if="validation && issues.length"
                type="error"
                class="tw-mt-4"
                ><ul>
                  <li v-for="issue in issues" :key="issue">{{ issue }}</li>
                </ul></v-alert
              >
            </template>
          </div>
          <div v-if="step === 3" class="form-panel review-panel">
            <v-alert v-if="issues.length" type="warning" class="tw-mb-4"
              ><p>پیش از خروجی گرفتن، این موارد را کامل کنید:</p>
              <ul>
                <li v-for="issue in issues" :key="issue">{{ issue }}</li>
              </ul>
              <v-btn variant="text" @click="step = 1">مشخصات و قالب</v-btn
              ><v-btn variant="text" @click="step = 2"
                >ویرایش سؤال‌ها</v-btn
              ></v-alert
            >
            <div class="panel-heading">
              <span class="section-number">۰۳</span>
              <div>
                <h2>یک نگاه آخر، پیش از چاپ</h2>
                <p>
                  پیش‌نمایش برگه را بررسی کنید و نسخه موردنیازتان را بگیرید.
                </p>
              </div>
            </div>
            <div class="review-check">
              <Icon name="check" />
              <div>
                <b>آزمون شما آماده بازبینی است</b>
                <p>
                  {{ digits(count(exam)) }} سؤال، {{ digits(pages) }} صفحه و
                  {{ digits(sum / 100) }} نمره
                </p>
              </div>
            </div>
            <v-alert
              v-if="store.billing && pages > store.billing.plan.pages"
              type="warning"
              class="tw-mb-4"
            >
              پیش‌نمایش {{ digits(pages) }} صفحه است؛ طرح
              {{ store.billing.plan.name }} تا
              {{ digits(store.billing.plan.pages) }} صفحه در هر خروجی دارد.
              می‌توانید ویرایش را ادامه دهید.
              <router-link to="/pricing">مشاهده طرح‌ها</router-link>
            </v-alert>
            <v-alert v-if="previewError" type="error">{{
              previewError
            }}</v-alert>
            <v-alert v-if="!online || store.needsAuth" type="info"
              >ویرایش روی دستگاه محفوظ است. برای ساخت PDF به اینترنت متصل و وارد
              حساب شوید.</v-alert
            >
            <v-btn
              v-if="phone"
              block
              variant="outlined"
              @click="previewDialog = true"
              >بازبینی برگه و صفحه‌ها</v-btn
            >
            <p class="muted">
              نسخه دانش‌آموز شامل سؤال‌ها و فضای پاسخ است. پاسخ‌نامه مدرس
              جداگانه آماده می‌شود.
            </p>
            <v-btn
              color="primary"
              block
              size="large"
              class="tw-mt-6"
              :loading="exporting && pdfKind === 'student'"
              :disabled="
                exporting || !!previewError || !online || store.needsAuth
              "
              @click="exportPdf('student')"
              ><Icon name="eye" class="tw-me-2" />بازبینی PDF و دریافت
              برگه</v-btn
            ><v-btn
              variant="outlined"
              block
              class="tw-mt-3"
              :loading="exporting && pdfKind === 'answer-key'"
              :disabled="
                exporting || !!previewError || !online || store.needsAuth
              "
              @click="exportPdf('answer-key')"
              >دریافت پاسخ‌نامه مدرس</v-btn
            >
            <p v-if="exporting" role="status" class="export-note">
              <v-progress-linear
                indeterminate
                color="primary"
                class="tw-mb-3"
              />در حال آماده‌سازی فونت‌ها، تصاویر و صفحه‌بندی…
            </p>
            <p class="field-hint tw-mt-4">
              چاپ روی کاغذ A4 با مقیاس ۱۰۰٪. فایل PDF متن قابل انتخاب دارد.
            </p>
          </div>
        </section>
      </div>
    </div>
    <nav class="step-footer" aria-label="ناوبری مراحل آزمون">
      <v-btn variant="outlined" :disabled="step === 1" @click="step--"
        >مرحله قبل</v-btn
      >
      <v-btn
        class="mobile-preview-button"
        variant="outlined"
        color="primary"
        aria-haspopup="dialog"
        @click="previewDialog = true"
        ><span class="mobile-preview-button-content"
          ><Icon name="eye" :size="18" /><span>پیش‌نمایش</span></span
        ></v-btn
      >
      <span class="step-footer-label"
        >{{ digits(step) }} / {{ digits(3) }}</span
      >
      <v-btn color="primary" :disabled="step === 3" @click="step++"
        >مرحله بعد</v-btn
      >
    </nav>
    <v-dialog
      v-model="previewDialog"
      :fullscreen="phone"
      max-width="950"
      scrollable
      class="mobile-editor-dialog"
    >
      <v-card title="پیش‌نمایش برگه">
        <v-card-text
          ><PaperPreview
            v-if="previewDialog"
            :exam="exam"
            interactive
            @pages="pages = $event"
            @error="previewError = $event"
        /></v-card-text>
        <v-card-actions
          ><v-btn @click="previewDialog = false"
            >بستن پیش‌نمایش</v-btn
          ></v-card-actions
        >
      </v-card>
    </v-dialog>
    <div class="builder-summary">
      <div>
        <Icon name="file" :size="19" />{{ digits(count(exam)) }} سؤال
        <span>•</span> مجموع نمره: <b>{{ digits(sum / 100) }}</b>
      </div>
      <span
        >{{ exam.layout.language === "fa" ? "برگه فارسی" : "English sheet" }} ·
        {{
          printStyles.find(
            (style) => style.id === (exam.layout.style || "formal"),
          )?.label
        }}</span
      >
    </div>
  </div>
  <v-alert v-else-if="error" type="error"
    >{{ error
    }}<router-link to="/dashboard">بازگشت به کتابخانه</router-link></v-alert
  >
  <div v-else class="loading-state">در حال بازکردن آزمون…</div>
  <v-dialog
    v-model="outlineDialog"
    :fullscreen="phone"
    max-width="540"
    scrollable
  >
    <v-card title="ساختار آزمون"
      ><v-card-text>
        <v-list aria-label="سؤال‌های آزمون"
          ><v-list-item
            v-for="(q, index) in exam?.questions || []"
            :key="q.id"
            :active="selectedQuestion === index"
            @click="
              selectedQuestion = index;
              outlineDialog = false;
            "
            :title="`${digits(index + 1)} · ${plain(q.body).slice(0, 80) || 'سؤال جدید'}`"
            :subtitle="
              types.find((t) => t.id === q.type)?.label || 'عنوان بخش'
            "
        /></v-list> </v-card-text
      ><v-card-actions
        ><v-btn @click="outlineDialog = false"
          >بازگشت به ویرایش</v-btn
        ></v-card-actions
      ></v-card
    >
  </v-dialog>
  <v-dialog v-model="addDialog" max-width="540" class="mobile-sheet">
    <v-card title="افزودن به آزمون"
      ><v-card-text
        ><div class="mobile-add-types">
          <button v-for="type in types" :key="type.id" @click="add(type.id)">
            <Icon :name="type.id" /><b>{{ type.label }}</b
            ><small>{{ type.description }}</small>
          </button>
          <button @click="add('section')">
            <Icon name="plus" /><b>عنوان بخش</b
            ><small>جداسازی فصل‌ها یا موضوع‌ها</small>
          </button>
        </div></v-card-text
      ><v-card-actions
        ><v-btn @click="addDialog = false">انصراف</v-btn></v-card-actions
      ></v-card
    >
  </v-dialog>
  <v-snackbar :model-value="!!deleted" :timeout="-1"
    ><span>سؤال حذف شد.</span
    ><template #actions
      ><v-btn @click="undo">بازگرداندن</v-btn
      ><v-btn @click="deleted = null">بستن</v-btn></template
    ></v-snackbar
  ><v-dialog v-model="pdfDialog" :fullscreen="phone" max-width="1000"
    ><v-card
      :title="
        pdfKind === 'answer-key' ? 'پاسخ‌نامه ویژه مدرس' : 'نسخه نهایی آزمون'
      "
      ><v-card-text
        ><iframe
          v-if="pdfUrl"
          :src="pdfUrl"
          title="بازبینی فایل PDF"
          class="pdf-frame"
        />
        <p class="field-hint">
          اگر مرورگر شما پیش‌نمایش PDF را نمایش نمی‌دهد، فایل را دریافت کنید.
        </p></v-card-text
      ><v-card-actions
        ><v-btn color="primary" variant="flat" @click="download"
          ><Icon name="download" class="tw-me-2" />دریافت PDF</v-btn
        ><v-btn @click="pdfDialog = false">بازگشت به ویرایش</v-btn
        ><v-btn @click="download(true)">اشتراک‌گذاری PDF</v-btn></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>

<style scoped src="../studio.css"></style>
