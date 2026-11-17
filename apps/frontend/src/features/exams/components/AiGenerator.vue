<script setup>
import { useMediaQuery } from "@vueuse/core";
const phoneEditor = useMediaQuery("(max-width: 767px)");
import MatchingEditor from "./MatchingEditor.vue";
import Icon from "../../../components/Icon.vue";
import { persianDigits as fa, englishDigits } from "../../../lib/numbers.js";
import { VCardTitle, VSpacer } from "vuetify/components";
import {
  ref,
  reactive,
  computed,
  shallowRef,
  onBeforeUnmount,
  nextTick,
  watch,
  useId,
} from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { api, useExams } from "../store.js";
import { generationSchema } from "@exam/shared/ai.js";
import { newExam, parseExam, validateForExport } from "@exam/shared/exam.js";
import OptionEditor from "./OptionEditor.vue";
import MathTextField from "./MathTextField.vue";
import RichEditor from "./RichEditor.vue";
const props = defineProps({ exam: Object, disabled: Boolean });
const emit = defineEmits(["insert"]);
const store = useExams();
const open = ref(false),
  stage = ref(1),
  busy = ref(false),
  pdfBusy = ref(false),
  error = ref(""),
  status = ref(null),
  loading = ref(false);
const drafts = ref([]),
  selected = ref([]),
  replaceDialog = ref(false),
  leaveDialog = ref(false);
const pdf = shallowRef(null),
  pdfName = ref(""),
  pageRange = ref("1"),
  extractNotice = ref("");
const form = reactive({
  topic: "",
  source: "",
  subject: "",
  grade: "",
  language: "fa",
  difficulty: "medium",
  instructions: "",
  counts: { mcq: 5, blank: 0, written: 0, matching: 0 },
  marks: "1",
});
const stageCopy = {
  1: {
    title: "از محتوای شما، سؤال‌های تازه",
    description:
      "موضوع را مشخص کنید، متن درس را بنویسید یا از یک فایل PDF کمک بگیرید.",
  },
  2: {
    title: "آزمون را به شیوه خودتان بسازید",
    description:
      "ترکیب سؤال‌ها، سطح دشواری و بارم را متناسب با کلاس تنظیم کنید.",
  },
  3: {
    title: "انتخاب نهایی با شماست",
    description:
      "سؤال‌ها و پاسخ‌ها را بازبینی کنید؛ فقط موارد انتخابی وارد آزمون می‌شوند.",
  },
};
const typeLabels = {
  mcq: "چندگزینه‌ای",
  blank: "جای خالی",
  written: "تشریحی",
  matching: "وصل‌کردنی",
};
const total = computed(() =>
  Object.values(form.counts).reduce((a, b) => a + (Number(b) || 0), 0),
);
const canUse = computed(
  () => status.value?.entitled || drafts.value.length > 0,
);
const dialogContent = ref(null);
const dialogTitleId = useId();
watch(stage, async () => {
  await nextTick();
  dialogContent.value?.$el?.scrollTo({ top: 0 });
});
const selectedDrafts = computed(() =>
  drafts.value.filter((q) => selected.value.includes(q.id)),
);
const capacity = computed(() => Math.max(0, 200 - props.exam.questions.length));
let requestKey,
  lastPayload,
  disposed = false;
const retryPending = ref(false);
const canRecover = computed(
  () => retryPending.value && lastPayload === JSON.stringify(form),
);
async function launch() {
  open.value = true;
  error.value = "";
  loading.value = true;
  if (!drafts.value.length && !form.topic && !form.source)
    Object.assign(form, {
      subject: props.exam.meta.course,
      grade: props.exam.meta.grade,
      language: props.exam.layout.language,
    });
  try {
    status.value = await api("/ai/status");
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function pickPdf(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  pdfBusy.value = true;
  error.value = "";
  extractNotice.value = "";
  try {
    const { openTextPdf } = await import("../aiPdf.js");
    const doc = await openTextPdf(file);
    if (disposed) {
      await doc.loadingTask.destroy();
      return;
    }
    await pdf.value?.loadingTask.destroy();
    pdf.value = doc;
    pdfName.value = file.name;
    pageRange.value = "1";
  } catch (e) {
    error.value = e.message;
  } finally {
    pdfBusy.value = false;
    event.target.value = "";
  }
}
async function extract() {
  pdfBusy.value = true;
  error.value = "";
  try {
    const { extractPdfPages } = await import("../aiPdf.js");
    const text = await extractPdfPages(pdf.value, pageRange.value);
    form.source = text;
    extractNotice.value =
      "متن استخراج شد. آن را بررسی و در صورت نیاز اصلاح کنید؛ ترتیب متن فارسی و فرمول‌ها ممکن است نیاز به ویرایش داشته باشد.";
  } catch (e) {
    error.value = e.message;
  } finally {
    pdfBusy.value = false;
  }
}
function advance() {
  error.value = "";
  if (!form.topic.trim() && !form.source.trim()) {
    error.value = "موضوع یا متن درس را وارد کنید.";
    return;
  }
  if (form.source.length > 12000) {
    error.value = "متن درس بیش از ۱۲۰۰۰ نویسه است؛ آن را کوتاه‌تر کنید.";
    return;
  }
  stage.value = 2;
}
function requestGeneration() {
  if (drafts.value.length) replaceDialog.value = true;
  else generate();
}
const aiConsent = ref(false);
async function generate() {
  if (!aiConsent.value) {
    error.value = "ارسال متن و تنظیمات به Groq نیاز به تأیید شما دارد.";
    return;
  }
  replaceDialog.value = false;
  error.value = "";
  const payload = JSON.parse(JSON.stringify(form));
  const signature = JSON.stringify(payload);
  if (!requestKey || lastPayload !== signature) {
    requestKey = crypto.randomUUID();
    lastPayload = signature;
  }
  const input = { ...payload, requestKey };
  if (!generationSchema.safeParse(input).success) {
    error.value =
      "تنظیمات را بررسی کنید: ۱ تا ۱۰ سؤال، نمره مثبت و متن درس حداکثر ۱۲۰۰۰ نویسه.";
    return;
  }
  busy.value = true;
  try {
    const result = await api("/ai/generate", { method: "POST", body: input });
    drafts.value = result.questions;
    selected.value = result.questions.map((q) => q.id);
    status.value = result;
    stage.value = 3;
    requestKey = null;
    lastPayload = null;
    retryPending.value = false;
    await store.refreshBilling().catch(() => {});
  } catch (e) {
    error.value = e.message;
    // Preserve the key for network failures so retry can recover an already completed batch.
    if (e.code && e.code !== "AI_IN_PROGRESS" && e.status < 500)
      requestKey = null;
    retryPending.value = !!requestKey;
    await api("/ai/status")
      .then((s) => (status.value = s))
      .catch(() => {});
  } finally {
    busy.value = false;
  }
}
const draftIssues = computed(() => {
  const exam = newExam();
  exam.meta.title = "AI";
  exam.meta.course = "AI";
  exam.questions = selectedDrafts.value;
  try {
    parseExam(exam);
    return validateForExport(exam);
  } catch {
    return ["ساختار یا نمره سؤال‌های انتخابی معتبر نیست."];
  }
});
function insert() {
  error.value = "";
  if (!selectedDrafts.value.length || draftIssues.value.length) return;
  if (selectedDrafts.value.length > capacity.value) {
    error.value =
      "تعداد سؤال‌ها از ظرفیت آزمون بیشتر است. انتخاب‌ها را کمتر کنید.";
    return;
  }
  const inserted = structuredClone(
    JSON.parse(JSON.stringify(selectedDrafts.value)),
  );
  emit("insert", inserted);
  const ids = new Set(inserted.map((q) => q.id));
  drafts.value = drafts.value.filter((q) => !ids.has(q.id));
  selected.value = [];
  open.value = false;
  store.notice =
    "سؤال‌های انتخابی به آزمون اضافه شدند. پاسخ‌ها را پیش از انتشار بررسی کنید.";
}
function handleUnload(event) {
  if (drafts.value.length || busy.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", handleUnload);
let leaveResolve;
onBeforeRouteLeave(() => {
  if (!drafts.value.length && !busy.value) return true;
  leaveDialog.value = true;
  return new Promise((resolve) => (leaveResolve = resolve));
});
function resolveLeave(leave) {
  leaveDialog.value = false;
  leaveResolve?.(leave);
  leaveResolve = null;
}
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener("beforeunload", handleUnload);
  pdf.value?.loadingTask.destroy().catch(() => {});
  leaveResolve?.(false);
});
</script>
<template>
  <div class="ai-entry">
    <div>
      <b>سؤال‌ها را از درس خود بسازید</b>
      <p class="field-hint">
        موضوع، متن درس یا PDF؛ انتخاب و ویرایش پیش از افزودن به آزمون
      </p>
    </div>
    <v-btn color="primary" variant="tonal" :disabled="disabled" @click="launch"
      ><Icon name="lightning" :size="20" class="ai-launch-icon" />تولید سؤال با
      هوش مصنوعی</v-btn
    >
  </div>
  <v-dialog
    :fullscreen="phoneEditor"
    v-model="open"
    max-width="1080"
    scrollable
    :persistent="busy || pdfBusy"
    :content-props="{ 'aria-labelledby': dialogTitleId }"
  >
    <v-card class="ai-dialog">
      <v-card-title class="ai-dialog-title"
        ><div class="ai-brand">
          <span class="ai-brand-icon"
            ><Icon name="lightning" :size="26"
          /></span>
          <div>
            <span class="ai-eyebrow">آزمون‌برگ / همراه هوشمند مدرس</span>
            <h2 :id="dialogTitleId">دستیار طراحی سؤال</h2>
          </div>
        </div>
        <v-btn
          variant="text"
          icon
          :disabled="busy || pdfBusy"
          @click="open = false"
          aria-label="بستن دستیار"
          ><Icon name="close" /></v-btn
      ></v-card-title>
      <v-card-text ref="dialogContent" class="ai-dialog-body">
        <v-progress-linear
          v-if="loading"
          indeterminate
          aria-label="بررسی دسترسی"
        />
        <v-alert v-if="error" type="error" class="tw-mb-4" role="alert">{{
          error
        }}</v-alert>
        <section v-if="status && !canUse" class="ai-upgrade">
          <span class="ai-upgrade-icon"
            ><Icon name="lightning" :size="36" /></span
          ><span class="ai-eyebrow">یک همراه تازه برای آماده‌سازی کلاس</span>
          <h3>طرح حرفه‌ای هوشمند</h3>
          <p>
            همه امکانات حرفه‌ای به همراه ۱۰۰ دسته سؤال در ماه، هر دسته تا ۱۰
            سؤال؛ ماهانه ۴۹۹٬۰۰۰ تومان.
          </p>
          <p>تولید سؤال از موضوع، متن درس و PDF با پاسخ‌نامه و امکان ویرایش.</p>
          <v-btn color="primary" to="/pricing">مشاهده طرح‌ها</v-btn>
          <p class="field-hint">
            اگر اشتراک فعال دارید، پس از پایان آن می‌توانید طرح جدید را تهیه
            کنید. خرید اندروید از طریق بازار انجام می‌شود.
          </p>
        </section>
        <template v-else-if="canUse">
          <div class="ai-consent">
            <v-checkbox
              v-model="aiConsent"
              label="با ارسال متن و تنظیمات این درخواست به Groq موافقم"
            /><router-link to="/privacy">جزئیات حریم خصوصی</router-link>
            <p class="field-hint">
              اطلاعات خصوصی دانش‌آموزان را ارسال نکنید. پاسخ‌ها را پیش از
              استفاده بررسی کنید.
            </p>
          </div>
          <nav class="ai-steps" aria-label="مراحل تولید سؤال">
            <div
              v-for="(label, index) in [
                'منبع درس',
                'تنظیم سؤال‌ها',
                'بازبینی و انتخاب',
              ]"
              :key="label"
              :class="{
                active: stage === index + 1,
                complete: stage > index + 1,
              }"
              :aria-current="stage === index + 1 ? 'step' : undefined"
            >
              <span class="ai-step-number"
                ><Icon
                  v-if="stage > index + 1"
                  name="check"
                  :size="17"
                /><template v-else>{{ fa(index + 1) }}</template></span
              ><span>{{ label }}</span>
            </div>
          </nav>
          <div class="ai-stage-heading">
            <div>
              <h3>{{ stageCopy[stage].title }}</h3>
              <p>{{ stageCopy[stage].description }}</p>
            </div>
            <div
              class="ai-allowance"
              role="status"
              aria-label="سهمیه باقی‌مانده این دوره"
              aria-live="polite"
            >
              <Icon name="lightning" :size="17" /><b
                >{{ fa(status.remaining) }}
                <small>از {{ fa(status.limit) }} دسته باقی‌مانده</small></b
              >
            </div>
          </div>
          <v-alert v-if="!status.available" type="warning" class="tw-mb-4"
            >سرویس تولید سؤال فعلاً در دسترس نیست. متن و پیش‌نویس شما محفوظ
            است.</v-alert
          >
          <div v-show="stage === 1" class="ai-source-layout">
            <div class="ai-source-main">
              <v-text-field
                v-model="form.topic"
                label="موضوع یا فصل درس"
                maxlength="500"
                counter
              />
              <v-alert
                v-if="extractNotice"
                type="info"
                variant="tonal"
                class="tw-my-3"
                >{{ extractNotice }}</v-alert
              >
              <v-textarea
                v-model="form.source"
                label="متن درس؛ این متن مبنای سؤال‌ها خواهد بود"
                rows="8"
                counter="12000"
                :error="form.source.length > 12000"
                hint="متن را بچسبانید یا از PDF استخراج کنید. از درج اطلاعات خصوصی دانش‌آموزان خودداری کنید."
                persistent-hint
              />
            </div>
            <aside class="ai-pdf-box">
              <span class="ai-upload-symbol"
                ><Icon name="upload" :size="28"
              /></span>
              <h4>از جزوه به سؤال</h4>
              <p class="ai-upload-intro">
                متن صفحه‌های دلخواهتان را از PDF وارد کنید.
              </p>
              <label class="ai-file-label"
                >انتخاب PDF متنی (تا ۱۰ مگابایت، ۱۰۰ صفحه)<input
                  type="file"
                  accept="application/pdf,.pdf"
                  :disabled="pdfBusy"
                  @change="pickPdf"
              /></label>
              <p class="field-hint">
                فایل روی دستگاه شما خوانده می‌شود. فقط متن بررسی‌شده هنگام تولید
                به سرویس هوش مصنوعی ارسال می‌شود. PDF اسکن‌شده فعلاً پشتیبانی
                نمی‌شود.
              </p>
              <template v-if="pdf"
                ><p>{{ pdfName }} · {{ fa(pdf.numPages) }} صفحه</p>
                <v-text-field
                  v-model="pageRange"
                  label="صفحه‌های انتخابی؛ مانند ۱-۳،۵"
                  hint="حداکثر ۱۰ صفحه"
                  persistent-hint
                /><v-btn
                  class="tw-mt-3"
                  variant="outlined"
                  :loading="pdfBusy"
                  @click="extract"
                  >استخراج متن صفحه‌ها</v-btn
                ></template
              >
              <v-progress-linear
                v-if="pdfBusy"
                indeterminate
                class="tw-mt-3"
                aria-label="خواندن PDF"
              />
            </aside>
          </div>
          <div v-show="stage === 2" class="ai-configuration">
            <section class="ai-config-section">
              <h4><Icon name="school" :size="20" /> مشخصات کلاس</h4>
              <div class="ai-field-grid">
                <v-text-field
                  v-model="form.subject"
                  label="درس"
                  maxlength="200"
                /><v-text-field
                  v-model="form.grade"
                  label="پایه یا سطح تحصیلی"
                  maxlength="100"
                /><v-select
                  v-model="form.language"
                  label="زبان سؤال‌ها"
                  :items="[
                    { title: 'فارسی', value: 'fa' },
                    { title: 'English', value: 'en' },
                  ]"
                /><v-select
                  v-model="form.difficulty"
                  label="دشواری"
                  :items="[
                    { title: 'آسان', value: 'easy' },
                    { title: 'متوسط', value: 'medium' },
                    { title: 'دشوار', value: 'hard' },
                  ]"
                />
              </div>
            </section>
            <section class="ai-config-section">
              <h4><Icon name="mcq" :size="20" /> ترکیب سؤال‌ها و بارم</h4>
              <p class="ai-section-hint">
                برای هر نوع، تعداد دلخواه را وارد کنید. مجموع هر دسته حداکثر ۱۰
                سؤال است.
              </p>
              <div class="ai-count-grid">
                <v-text-field
                  v-for="(label, type) in typeLabels"
                  :key="type"
                  :model-value="fa(form.counts[type])"
                  @update:model-value="
                    form.counts[type] = Number(englishDigits($event)) || 0
                  "
                  inputmode="numeric"
                  min="0"
                  max="10"
                  :label="'تعداد سؤال ' + label"
                /><v-text-field
                  :model-value="fa(form.marks)"
                  @update:model-value="
                    form.marks = englishDigits($event).replace('٫', '.')
                  "
                  label="نمره هر سؤال"
                  inputmode="decimal"
                />
              </div>
              <p :class="{ 'text-error': total < 1 || total > 10 }">
                مجموع: {{ fa(total) }} سؤال (۱ تا ۱۰)
              </p>
            </section>
            <section class="ai-config-section">
              <h4><Icon name="written" :size="20" /> راهنمای شما برای طراحی</h4>
              <v-textarea
                v-model="form.instructions"
                label="توضیحات مدرس (اختیاری)"
                maxlength="1000"
                rows="3"
              />
              <p class="field-hint">
                هر دسته موفق یک سهمیه مصرف می‌کند، حتی اگر سؤال‌ها را به آزمون
                اضافه نکنید. درخواست ناموفق سهمیه ماهانه را کم نمی‌کند.
              </p>
            </section>
          </div>
          <div v-if="stage === 3" class="ai-review">
            <v-alert type="info" variant="tonal" class="tw-mb-4"
              >درستی سؤال‌ها، گزینه‌ها و پاسخ‌نامه را پیش از استفاده بررسی کنید.
              تنها سؤال‌های انتخابی به پایان آزمون اضافه می‌شوند.</v-alert
            >
            <article
              v-for="(q, index) in drafts"
              :key="q.id"
              class="ai-draft"
              :dir="form.language === 'fa' ? 'rtl' : 'ltr'"
            >
              <div class="ai-draft-heading">
                <span class="ai-draft-number">{{ fa(index + 1) }}</span
                ><v-checkbox
                  v-model="selected"
                  :value="q.id"
                  :label="`انتخاب سؤال ${fa(index + 1)} · ${typeLabels[q.type]}`"
                  hide-details
                /><span class="ai-draft-badge">{{ typeLabels[q.type] }}</span>
              </div>
              <RichEditor
                v-model="q.body"
                compact
                :label="'متن سؤال ' + fa(index + 1)"
                :allow-blank="q.type === 'blank' || q.type === 'matching'"
              />
              <MatchingEditor
                v-if="q.type === 'matching'"
                v-model="q.matching"
                :language="form.language"
              />
              <div v-if="q.type === 'mcq'" class="ai-field-grid">
                <OptionEditor
                  v-for="(_, i) in q.options"
                  :key="i"
                  v-model="q.options[i]"
                  :label="'گزینه ' + fa(i + 1)"
                  maxlength="2000"
                />
              </div>
              <v-text-field
                :model-value="fa(q.marks)"
                @update:model-value="
                  q.marks = englishDigits($event).replace('٫', '.')
                "
                label="نمره سؤال"
                inputmode="decimal"
              />
              <MathTextField
                multiline
                auto-grow
                no-resize
                v-model="q.answer"
                label="پاسخ و توضیح (ویژه مدرس)"
                maxlength="4000"
                rows="3"
              />
            </article>
            <v-alert
              v-if="selected.length && draftIssues.length"
              type="warning"
              >{{ draftIssues.join(" ") }}</v-alert
            >
            <p role="status">
              {{ fa(selected.length) }} سؤال انتخاب شده · ظرفیت باقی‌مانده
              آزمون:
              {{ fa(capacity) }}
            </p>
          </div>
          <div v-if="busy" role="status" aria-live="polite" class="ai-working">
            <v-progress-linear indeterminate />
            <p>در حال طراحی سؤال‌ها… این کار ممکن است تا یک دقیقه طول بکشد.</p>
          </div>
        </template>
      </v-card-text>
      <v-card-actions v-if="canUse" class="ai-footer"
        ><span class="ai-footer-note"
          ><Icon :name="stage === 3 ? 'check' : 'file'" :size="17" />{{
            stage === 3
              ? `${fa(selected.length)} سؤال انتخاب شده`
              : "پیش از افزودن، همه سؤال‌ها قابل ویرایش‌اند"
          }}</span
        >
        <v-btn v-if="stage > 1" variant="text" :disabled="busy" @click="stage--"
          >بازگشت</v-btn
        >
        <v-spacer />
        <v-btn
          v-if="stage === 1"
          color="primary"
          :disabled="pdfBusy"
          @click="advance"
          >ادامه؛ تنظیم سؤال‌ها</v-btn
        >
        <v-btn
          v-if="stage === 2"
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="
            ((!status.available || !status.remaining) && !canRecover) ||
            total < 1 ||
            total > 10
          "
          @click="requestGeneration"
          ><Icon name="lightning" :size="18" class="ai-launch-icon" />تولید
          سؤال‌ها</v-btn
        >
        <v-btn
          v-if="stage === 3"
          color="primary"
          variant="flat"
          :disabled="
            disabled ||
            !selected.length ||
            !!draftIssues.length ||
            selected.length > capacity
          "
          @click="insert"
          >افزودن سؤال‌های انتخابی</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="replaceDialog" max-width="460"
    ><v-card
      title="ساخت دسته جدید؟"
      text="پس از تولید موفق، پیش‌نویس‌های فعلی جایگزین می‌شوند و یک سهمیه جدید مصرف خواهد شد."
      ><v-card-actions
        ><v-btn @click="replaceDialog = false">انصراف</v-btn
        ><v-btn color="primary" @click="generate"
          >تولید دسته جدید</v-btn
        ></v-card-actions
      ></v-card
    ></v-dialog
  >
  <v-dialog v-model="leaveDialog" persistent max-width="460"
    ><v-card
      title="خروج از دستیار؟"
      text="پیش‌نویس‌های اضافه‌نشده با خروج از صفحه از دست می‌روند. درخواست در حال پردازش ممکن است همچنان سهمیه مصرف کند."
      ><v-card-actions
        ><v-btn @click="resolveLeave(false)">ماندن در صفحه</v-btn
        ><v-btn color="primary" @click="resolveLeave(true)"
          >خروج</v-btn
        ></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>
<style scoped src="../ai-generator.css"></style>
