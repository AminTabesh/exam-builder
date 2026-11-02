<script setup>
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useOnline, useEventListener } from "@vueuse/core";
import Sortable from "sortablejs";
import { useExams, api } from "../stores/exams";
import {
  newQuestion,
  total,
  count,
  digits,
  hundredths,
  plain,
  validateForExport,
  uid,
} from "../../shared/exam";
import DateField from "./DateField.vue";
import Icon from "./Icon.vue";
import RichEditor from "./RichEditor.vue";
import PaperPreview from "./PaperPreview.vue";
const route = useRoute(),
  router = useRouter(),
  store = useExams(),
  online = useOnline(),
  exam = ref(null),
  revision = ref(1),
  step = ref(1),
  saveState = ref("saved"),
  error = ref(""),
  validation = ref(false),
  previewError = ref(""),
  mobilePreview = ref(false),
  pages = ref(1),
  questionList = ref(null),
  deleted = ref(null),
  exporting = ref(false),
  pdfUrl = ref(""),
  pdfKind = ref("student"),
  pdfDialog = ref(false),
  conflict = ref(false);
let timer,
  sorter,
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
    !JSON.stringify(q.body).includes('"formula"')
  )
    return "متن این سؤال را بنویسید.";
  if (q.type === "blank" && !JSON.stringify(q.body).includes('"blank"'))
    return "با دکمه درج جای خالی، محل پاسخ را مشخص کنید.";
  return "";
}
function cache() {
  try {
    localStorage.setItem(
      draftKey(),
      JSON.stringify({
        document: exam.value,
        revision: revision.value,
        change,
      }),
    );
    cacheOk = true;
  } catch {
    cacheOk = false;
    error.value = "حافظه مرورگر پر است. تا ذخیره موفق، این صفحه را نبندید.";
  }
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
    saveState.value = "offline";
    cache();
    return false;
  }
  const snapshot = JSON.parse(JSON.stringify(exam.value)),
    version = change;
  saveState.value = "saving";
  saving = (async () => {
    try {
      const result = await store.save(id, snapshot, revision.value);
      revision.value = result.revision;
      savedChange = version;
      saveState.value = version === change ? "saved" : "pending";
      if (version === change) localStorage.removeItem(draftKey());
      else cache();
      error.value = "";
      return true;
    } catch (e) {
      error.value = e.message;
      saveState.value = e.status === 409 ? "conflict" : "error";
      conflict.value = e.status === 409;
      cache();
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
    if (!conflict.value) saveState.value = online.value ? "pending" : "offline";
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
    const pending = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (pending) {
      exam.value = pending.document;
      delete exam.value.layout.target;
      change = 1;
      if (pending.revision !== row.revision) {
        conflict.value = true;
        saveState.value = "conflict";
        error.value =
          "نسخه ذخیره‌شده با پیش‌نویس این دستگاه متفاوت است. برای نگه‌داشتن تغییرات، یک کپی بسازید.";
      } else {
        saveState.value = "pending";
        store.notice = "تغییرات ذخیره‌نشده بازیابی شد.";
      }
    }
    await nextTick();
  } catch (e) {
    error.value = e.message;
  } finally {
    hydrating = false;
    if (change && !conflict.value) save();
  }
}
async function reload() {
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
    localStorage.removeItem(draftKey());
    conflict.value = false;
    savedChange = change;
    await router.push("/exam/" + row.id);
  } catch (e) {
    error.value = e.message;
  }
}
function goNext() {
  validation.value = true;
  if (
    step.value === 1 &&
    (!exam.value.meta.title.trim() || !exam.value.meta.course.trim())
  )
    return;
  if (step.value === 2 && issues.value.length) return;
  step.value = Math.min(3, step.value + 1);
  validation.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function add(type) {
  exam.value.questions.push(newQuestion(type));
  nextTick(() => {
    const editors = document.querySelectorAll(".question-card .tiptap");
    editors[editors.length - 1]?.focus();
  });
}
function move(index, delta) {
  const [q] = exam.value.questions.splice(index, 1);
  exam.value.questions.splice(index + delta, 0, q);
}
function duplicate(index) {
  const q = JSON.parse(JSON.stringify(exam.value.questions[index]));
  q.id = uid();
  exam.value.questions.splice(index + 1, 0, q);
}
function remove(index) {
  deleted.value = { question: exam.value.questions[index], index };
  exam.value.questions.splice(index, 1);
}
function undo() {
  if (deleted.value) {
    exam.value.questions.splice(deleted.value.index, 0, deleted.value.question);
    deleted.value = null;
  }
}
function cleanupSorter() {
  const previous = sorter;
  sorter = null;
  previous?.destroy();
}
watch(
  questionList,
  (el) => {
    cleanupSorter();
    if (el?.isConnected)
      sorter = Sortable.create(el, {
        handle: ".drag-handle",
        animation: 150,
        onEnd(event) {
          if (event.oldIndex === event.newIndex) return;
          const child = el.children[event.newIndex];
          el.insertBefore(
            child,
            el.children[
              event.oldIndex + (event.newIndex < event.oldIndex ? 1 : 0)
            ] || null,
          );
          move(event.oldIndex, event.newIndex - event.oldIndex);
        },
      });
  },
  { flush: "post" },
);
function changeLanguage(value) {
  exam.value.meta.calendar = value === "fa" ? "jalali" : "gregorian";
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
    const blob = store.user
      ? await api("/exams/" + id + "/pdf", {
          method: "POST",
          body: { revision: revision.value, kind },
        })
      : await api("/demo/pdf", {
          method: "POST",
          body: { document: exam.value, kind },
        });
    if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
    pdfUrl.value = URL.createObjectURL(blob);
    pdfDialog.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    exporting.value = false;
  }
}
function download() {
  const a = document.createElement("a");
  a.href = pdfUrl.value;
  a.download =
    (exam.value.meta.title || "exam") +
    (pdfKind.value === "answer-key" ? " - پاسخ‌نامه" : "") +
    ".pdf";
  a.click();
}
useEventListener(window, "beforeunload", (event) => {
  if (change > savedChange) {
    cache();
    event.preventDefault();
    event.returnValue = "";
  }
});
onBeforeRouteLeave(async () => {
  const ok = await save();
  if (!ok && !cacheOk) {
    error.value = "ذخیره آزمون انجام نشد. پیش از خروج، دوباره ذخیره کنید.";
    return false;
  }
  return true;
});
onMounted(load);
onBeforeUnmount(() => {
  clearTimeout(timer);
  cleanupSorter();
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
});
</script>
<template>
  <div v-if="exam" class="builder">
    <div class="builder-heading">
      <div>
        <router-link to="/" class="back-link"
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
    <nav class="mobile-steps" aria-label="مراحل ساخت آزمون" aria-live="polite">
      <span>مرحله {{ digits(step) }} از {{ digits(3) }}</span>
      <strong>{{ steps[step - 1] }}</strong>
      <div class="step-segments">
        <span v-for="i in 3" :key="i" :class="{ active: i <= step }"></span>
      </div>
    </nav>
    <v-stepper
      v-model="step"
      alt-labels
      flat
      hide-actions
      class="builder-stepper"
      role="navigation"
      aria-label="مراحل ساخت آزمون"
    >
      <v-stepper-header :style="{ boxShadow: 'none' }">
        <v-stepper-item
          v-for="(label, i) in steps"
          :key="label"
          :value="i + 1"
          :title="label"
          :complete="step > i + 1"
          :editable="i + 1 < step"
          :disabled="i + 1 > step"
          color="primary"
          class="tw-px-2 tw-py-4"
          :aria-current="step === i + 1 ? 'step' : undefined"
        >
          <template #icon
            ><Icon v-if="step > i + 1" name="check" :size="17" /><span v-else>{{
              digits(i + 1)
            }}</span></template
          >
          <template #title
            ><span class="builder-step-title">{{ label }}</span></template
          >
        </v-stepper-item>
      </v-stepper-header>
    </v-stepper>
    <v-alert v-if="error" type="error" class="tw-mb-4"
      >{{ error }}
      <div v-if="conflict" class="tw-mt-3">
        <v-btn @click="copyConflict">ساخت کپی از تغییرات من</v-btn
        ><v-btn variant="text" @click="reload">بارگذاری نسخه ذخیره‌شده</v-btn>
      </div></v-alert
    >
    <div class="mobile-preview-toggle">
      <v-btn
        :variant="!mobilePreview ? 'flat' : 'outlined'"
        @click="mobilePreview = false"
        >ویرایش آزمون</v-btn
      ><v-btn
        :variant="mobilePreview ? 'flat' : 'outlined'"
        @click="mobilePreview = true"
        >پیش‌نمایش برگه</v-btn
      >
    </div>
    <div class="builder-columns">
      <section
        class="editor-column"
        :class="{ 'mobile-hidden': mobilePreview }"
      >
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
          <details open>
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
                label="راهنمای ابتدای آزمون"
                rows="2"
              /><v-text-field
                v-model="exam.meta.closing"
                label="پیام پایان آزمون"
              />
              <div class="form-grid">
                <v-select
                  v-model="exam.layout.fontSize"
                  label="اندازه قلم برگه"
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
                  :disabled="!store.user"
                  @change="
                    async (event) => {
                      try {
                        const form = new FormData();
                        form.append('image', event.target.files[0]);
                        exam.meta.logo = (
                          await api('/assets', { method: 'POST', body: form })
                        ).src;
                      } catch (e) {
                        error = e.message;
                      }
                    }
                  "
              /></label>
              <p v-if="!store.user" class="field-hint">
                برای بارگذاری نشان مؤسسه وارد حساب شوید.
              </p>
              <v-btn
                v-if="exam.meta.logo"
                variant="text"
                @click="exam.meta.logo = ''"
                >حذف نشان</v-btn
              >
            </div>
          </details>
        </div>
        <div v-if="step === 2" class="questions-panel">
          <div class="panel-heading">
            <span class="section-number">۰۲</span>
            <div>
              <h2>حالا نوبت سؤال‌هاست</h2>
              <p>نوع سؤال را انتخاب کنید و متن آن را بنویسید.</p>
            </div>
          </div>
          <div class="question-type-grid">
            <button v-for="type in types" :key="type.id" @click="add(type.id)">
              <Icon :name="type.id" :size="25" /><b>{{ type.label }}</b
              ><small>{{ type.description }}</small
              ><span>＋ افزودن</span>
            </button>
          </div>
          <div v-if="!exam.questions.length" class="question-empty">
            اولین سؤال را از کارت‌های بالا اضافه کنید.
          </div>
          <div ref="questionList">
            <article
              v-for="(q, index) in exam.questions"
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
                :allow-blank="q.type === 'blank'"
              />
              <p
                v-if="validation && bodyError(q)"
                class="field-error"
                role="alert"
              >
                {{ bodyError(q) }}
              </p>
              <div v-if="q.type === 'mcq'" class="options-editor">
                <div v-for="(option, i) in q.options" :key="i">
                  <span class="option-number">{{ digits(i + 1) }}</span
                  ><v-text-field
                    v-model="q.options[i]"
                    :label="'گزینه ' + digits(i + 1)"
                    :hide-details="!validation"
                    :error-messages="
                      validation && !q.options[i].trim()
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
                  v-model="q.marks"
                  label="نمره سؤال"
                  inputmode="decimal"
                  :error-messages="scoreError(q.marks)"
                  :hide-details="!scoreError(q.marks)"
                  density="compact"
                /><template v-if="q.type === 'written'"
                  ><v-select
                    v-model="q.lines"
                    label="سطر پاسخ"
                    :items="[0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50]"
                    hide-details
                    density="compact" /><v-checkbox
                    v-model="q.lined"
                    label="خط‌دار"
                /></template>
              </div>
              <details>
                <summary>پاسخ‌نامه و صفحه‌بندی</summary>
                <div class="details-content">
                  <v-textarea
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
        </div>
        <div v-if="step === 3" class="form-panel review-panel">
          <div class="panel-heading">
            <span class="section-number">۰۳</span>
            <div>
              <h2>یک نگاه آخر، پیش از چاپ</h2>
              <p>پیش‌نمایش برگه را بررسی کنید و نسخه موردنیازتان را بگیرید.</p>
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
          <v-alert v-if="previewError" type="error">{{ previewError }}</v-alert>
          <p class="muted">
            نسخه دانش‌آموز شامل سؤال‌ها و فضای پاسخ است. پاسخ‌نامه مدرس جداگانه
            آماده می‌شود.
          </p>
          <v-btn
            color="primary"
            block
            size="large"
            class="tw-mt-6"
            :loading="exporting && pdfKind === 'student'"
            :disabled="exporting || !!previewError"
            @click="exportPdf('student')"
            ><Icon name="eye" class="tw-me-2" />بازبینی PDF و دریافت برگه</v-btn
          ><v-btn
            variant="outlined"
            block
            class="tw-mt-3"
            :loading="exporting && pdfKind === 'answer-key'"
            :disabled="exporting || !!previewError"
            @click="exportPdf('answer-key')"
            >دریافت پاسخ‌نامه مدرس</v-btn
          >
          <p v-if="exporting" role="status" class="export-note">
            <v-progress-linear
              indeterminate
              color="primary"
              class="tw-mb-3"
            />در حال آماده‌سازی قلم‌ها، تصاویر و صفحه‌بندی…
          </p>
          <p class="field-hint tw-mt-4">
            چاپ روی کاغذ A4 با مقیاس ۱۰۰٪. فایل PDF متن قابل انتخاب دارد.
          </p>
        </div>
        <div class="builder-actions">
          <v-btn
            v-if="step > 1"
            variant="text"
            @click="
              step--;
              validation = false;
            "
            ><Icon name="right" :size="18" class="tw-me-2" />مرحله قبل</v-btn
          ><span v-else></span
          ><v-btn v-if="step < 3" color="primary" size="large" @click="goNext"
            >{{ step === 1 ? "ادامه؛ افزودن سؤال‌ها" : "ادامه؛ بازبینی آزمون"
            }}<Icon name="left" :size="18" class="tw-ms-2"
          /></v-btn>
        </div>
      </section>
      <aside
        class="preview-column"
        :class="{ 'mobile-hidden': !mobilePreview }"
      >
        <div class="preview-heading">
          <div><Icon name="eye" :size="19" /><b>پیش‌نمایش برگه</b></div>
          <span>A4 · {{ digits(pages) }} صفحه</span>
        </div>
        <div class="preview-canvas">
          <PaperPreview
            :exam="exam"
            @pages="pages = $event"
            @error="previewError = $event"
          />
        </div>
        <div class="preview-caption">
          <span class="status-dot"></span>با تغییر اطلاعات، برگه به‌روز می‌شود.
        </div>
      </aside>
    </div>
    <div class="builder-summary">
      <div>
        <Icon name="file" :size="19" />{{ digits(count(exam)) }} سؤال
        <span>•</span> مجموع نمره: <b>{{ digits(sum / 100) }}</b>
      </div>
      <span
        >{{ exam.layout.language === "fa" ? "برگه فارسی" : "English sheet" }} ·
        {{
          exam.layout.template === "school" ? "قالب مدرسه" : "قالب دانشگاه"
        }}</span
      >
    </div>
  </div>
  <v-alert v-else-if="error" type="error"
    >{{ error }}<router-link to="/">بازگشت به کتابخانه</router-link></v-alert
  >
  <div v-else class="loading-state">در حال بازکردن آزمون…</div>
  <v-snackbar :model-value="!!deleted" :timeout="-1"
    ><span>سؤال حذف شد.</span
    ><template #actions
      ><v-btn @click="undo">بازگرداندن</v-btn
      ><v-btn @click="deleted = null">بستن</v-btn></template
    ></v-snackbar
  ><v-dialog v-model="pdfDialog" max-width="1000"
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
        ><v-btn @click="pdfDialog = false"
          >بازگشت به ویرایش</v-btn
        ></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>
