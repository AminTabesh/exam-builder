<script setup>
import { useMediaQuery } from "@vueuse/core";
const phoneEditor = useMediaQuery("(max-width: 767px)");
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from "vue";
import Icon from "../../../components/Icon.vue";
import { renderFormula } from "@exam/shared/math.js";
import {
  renderedFormulaGroups as groups,
  templateLatex,
  spliceFormula,
} from "../formulaTemplates.js";
const props = defineProps({
  modelValue: Boolean,
  initial: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "save"]);
const visual = ref(true),
  mathHost = ref(null),
  mathError = ref(""),
  search = ref(""),
  category = ref("all");
let mathfield;
let mountVersion = 0;
const hasSlots = computed(
  () =>
    root.latex.includes(String.fromCharCode(92) + "placeholder") ||
    root.latex.includes("#?") ||
    (visual.value && /[{]\s*[}]/.test(root.latex)),
);
function command(name) {
  if (!mathfield) return;
  mathfield.focus();
  mathfield.executeCommand(name);
  root.latex = mathfield.value;
}
onBeforeUnmount(() => {
  mountVersion++;
  mathfield = null;
});
const normalizeSearch = (value) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u200c]/g, "");
const filteredGroups = computed(() => {
  const query = normalizeSearch(search.value.trim());
  return groups
    .filter(
      (group) =>
        query || category.value === "all" || category.value === group.name,
    )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !query ||
          normalizeSearch(
            item.label + " " + item.code + " " + group.name,
          ).includes(query),
      ),
    }))
    .filter((group) => group.items.length);
});
async function mountMath() {
  const version = ++mountVersion;
  try {
    const { MathfieldElement } = await import("mathlive");
    MathfieldElement.fontsDirectory = "/mathlive/fonts";
    MathfieldElement.soundsDirectory = null;

    if (!props.modelValue || !mathHost.value || version !== mountVersion)
      return;
    mathfield = new MathfieldElement();
    mathfield.mathVirtualKeyboardPolicy = "manual";
    mathfield.setAttribute("inputmode", "text");
    mathfield.value = root.latex;
    mathfield.setAttribute("aria-label", "ویرایش بصری فرمول");
    mathfield.dir = "ltr";
    mathfield.addEventListener("input", (event) => {
      if (props.modelValue && version === mountVersion)
        root.latex = event.currentTarget.value;
    });
    mathHost.value.replaceChildren(mathfield);
    mathfield.menuItems = [];
    mathfield.shadowRoot
      ?.querySelector('[part="keyboard-sink"]')
      ?.setAttribute("inputmode", "text");
  } catch {
    if (!props.modelValue || version !== mountVersion) return;
    mathError.value = "ویرایشگر بصری بارگذاری نشد؛ از حالت LaTeX استفاده کنید.";
    visual.value = false;
  }
}
const root = reactive({ latex: "" }),
  frames = ref([]),
  rootInput = ref(null),
  dialogBody = ref(null);
watch(visual, async (value) => {
  await nextTick();
  if (value) {
    if (!mathfield) await mountMath();
    mathfield?.focus();
  } else if (!frames.value.length)
    focusTarget(root, "latex", root.latex.length);
});
watch(
  () => root.latex,
  (value) => {
    if (mathfield && mathfield.value !== value) mathfield.value = value;
  },
);
let target = null;
const frame = computed(() => frames.value.at(-1));
const preview = computed(() => safeRender(root.latex));
const frameCode = computed(() =>
  frame.value ? templateLatex(frame.value.item, frame.value.values) : "",
);
const framePreview = computed(() => safeRender(frameCode.value));
function safeRender(value) {
  try {
    return value?.trim() ? renderFormula(value) : "";
  } catch {
    return "";
  }
}
watch(
  () => props.modelValue,
  async (value) => {
    if (!value) {
      mountVersion++;
      mathfield = null;
      return;
    }
    search.value = "";
    category.value = "all";
    visual.value = true;
    mathError.value = "";
    root.latex = props.initial;
    frames.value = [];
    target = {
      container: root,
      key: "latex",
      start: root.latex.length,
      end: root.latex.length,
    };
    await nextTick();
    await mountMath();
    if (!visual.value) rootInput.value?.focus();
    rootInput.value?.setSelectionRange(target.start, target.end);
  },
);
function remember(event, container, key) {
  const input = event.target;
  target = {
    container,
    key,
    start: input.selectionStart ?? 0,
    end: input.selectionEnd ?? 0,
  };
}
async function focusTarget(container, key, cursor) {
  await nextTick();
  const input =
    container === root
      ? rootInput.value
      : dialogBody.value?.$el?.querySelector(`[data-param="${key}"]`);
  input?.focus();
  input?.setSelectionRange(cursor, cursor);
  target = { container, key, start: cursor, end: cursor };
}
function insertAt(destination, code) {
  const { container, key, start, end } = destination;
  const result = spliceFormula(container[key], start, end, code);
  container[key] = result.value;
  focusTarget(container, key, result.cursor);
}
async function choose(item) {
  if (visual.value && mathfield) {
    const code = item.code.replace(
      /[{][{]([a-zA-Z0-9_]+)[}][}]/g,
      String.fromCharCode(92) + "placeholder{}",
    );
    mathfield.insert(code, {
      format: "latex",
      selectionMode: item.fields.length ? "placeholder" : "after",
      focus: true,
    });
    root.latex = mathfield.value;
    return;
  }
  const destination = target || {
    container: root,
    key: "latex",
    start: root.latex.length,
    end: root.latex.length,
  };
  if (!item.fields.length) {
    insertAt(destination, item.code + " ");
    return;
  }
  const values = Object.fromEntries(item.fields.map((f) => [f.key, ""]));
  values[item.fields[0].key] = destination.container[destination.key].slice(
    destination.start,
    destination.end,
  );
  frames.value.push({ item, values, destination });
  await nextTick();
  const input = dialogBody.value?.$el?.querySelector("[data-param]");
  input?.focus();
  input?.select();
  target = {
    container: frame.value.values,
    key: item.fields[0].key,
    start: 0,
    end: values[item.fields[0].key].length,
  };
}
function insertTemplate() {
  if (
    !framePreview.value ||
    frame.value.item.fields.some((f) => !frame.value.values[f.key].trim())
  )
    return;
  const code = frameCode.value,
    destination = frame.value.destination;
  frames.value.pop();
  insertAt(destination, code);
}
function cancelTemplate() {
  const destination = frame.value.destination;
  frames.value.pop();
  focusTarget(destination.container, destination.key, destination.start);
}
function save() {
  if (
    root.latex.trim() &&
    root.latex.length <= 2000 &&
    preview.value &&
    !frames.value.length &&
    !hasSlots.value
  ) {
    emit("save", root.latex);
    emit("update:modelValue", false);
  }
}
</script>
<template>
  <v-dialog
    :fullscreen="phoneEditor"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="940"
    scrollable
  >
    <v-card class="formula-dialog">
      <header class="formula-header">
        <span class="formula-header-icon"
          ><Icon name="formula" :size="26"
        /></span>
        <div>
          <span class="formula-eyebrow">ویرایشگر ریاضی</span>
          <h2>فرمول را همان‌طور که می‌بینید بسازید</h2>
          <p>یک قالب انتخاب کنید و مستقیماً داخل خانه‌های فرمول بنویسید.</p>
        </div>
        <button
          type="button"
          class="formula-close"
          aria-label="بستن ساخت فرمول"
          @click="emit('update:modelValue', false)"
        >
          <Icon name="close" :size="20" />
        </button>
      </header>
      <v-card-text ref="dialogBody">
        <div class="math-mode-tabs">
          <v-btn
            :variant="visual ? 'tonal' : 'text'"
            :disabled="!!frames.length"
            @click="visual = true"
            >ویرایش بصری</v-btn
          ><v-btn :variant="!visual ? 'tonal' : 'text'" @click="visual = false"
            >LaTeX پیشرفته</v-btn
          >
        </div>
        <p v-if="mathError" role="status">{{ mathError }}</p>
        <section class="formula-workspace" v-show="visual">
          <div class="formula-workspace-heading">
            <strong>فرمول شما</strong>
            <div class="formula-tools">
              <button
                type="button"
                title="واگرد"
                aria-label="واگرد فرمول"
                @mousedown.prevent
                @click="command('undo')"
              >
                <Icon name="undo" :size="17" />
              </button>
              <button
                type="button"
                title="بازانجام"
                aria-label="بازانجام فرمول"
                @mousedown.prevent
                @click="command('redo')"
              >
                <Icon name="redo" :size="17" />
              </button>
              <button
                type="button"
                aria-label="خانه بعدی"
                @mousedown.prevent
                @click="command('moveToNextPlaceholder')"
              >
                خانه بعدی ←
              </button>
              <button
                type="button"
                aria-label="پاک کردن فرمول"
                title="پاک کردن فرمول"
                @mousedown.prevent
                @click="command('deleteAll')"
              >
                <Icon name="trash" :size="17" />
              </button>
            </div>
          </div>
          <div ref="mathHost" class="math-host" />
          <p class="formula-help">
            روی خانه‌های خالی بزنید و مقدار را تایپ کنید. برای ساختن فرمول
            تو‌در‌تو، در همان خانه یک قالب دیگر انتخاب کنید.
          </p>
        </section>
        <label v-show="!visual" class="formula-input-label"
          >فرمول LaTeX
          <textarea
            ref="rootInput"
            v-model="root.latex"
            class="formula-code-input"
            aria-label="فرمول LaTeX"
            dir="ltr"
            rows="3"
            maxlength="2000"
            spellcheck="false"
            @input="remember($event, root, 'latex')"
            @select="remember($event, root, 'latex')"
            @click="remember($event, root, 'latex')"
            @keyup="remember($event, root, 'latex')"
            @blur="remember($event, root, 'latex')"
          />
        </label>
        <div
          v-show="!visual"
          class="formula-preview"
          dir="ltr"
          aria-label="پیش‌نمایش فرمول"
          aria-live="polite"
          v-html="preview"
        />
        <p v-if="hasSlots" class="formula-help" role="status">
          خانه‌های خالی فرمول را کامل کنید.
        </p>
        <p
          v-if="root.latex && !preview && !hasSlots"
          class="field-error"
          role="alert"
        >
          ساختار فرمول معتبر نیست. آکولادها و دستورها را بررسی کنید.
        </p>
        <section
          v-if="frame"
          class="formula-parameters"
          :aria-label="'تنظیم ' + frame.item.label"
        >
          <h3>
            {{ frame.item.label
            }}<small v-if="frames.length > 1"> · قالب تو‌در‌تو</small>
          </h3>
          <div class="formula-param-grid">
            <label
              v-for="field in frame.item.fields"
              :key="field.key"
              class="formula-input-label"
              >{{ field.label }}
              <input
                v-model="frame.values[field.key]"
                :data-param="field.key"
                :aria-label="field.label"
                dir="ltr"
                class="formula-code-input"
                maxlength="1000"
                spellcheck="false"
                @input="remember($event, frame.values, field.key)"
                @select="remember($event, frame.values, field.key)"
                @click="remember($event, frame.values, field.key)"
                @keyup="remember($event, frame.values, field.key)"
                @blur="remember($event, frame.values, field.key)"
              />
            </label>
          </div>
          <div class="formula-preview" dir="ltr" v-html="framePreview" />
          <v-btn
            color="primary"
            :disabled="
              !framePreview ||
              frame.item.fields.some((f) => !frame.values[f.key].trim())
            "
            @mousedown.prevent
            @click="insertTemplate"
            >درج قالب</v-btn
          >
          <v-btn variant="text" @click="cancelTemplate">لغو قالب</v-btn>
        </section>
        <v-text-field
          v-model="search"
          label="جستجوی نماد یا قالب"
          placeholder="مثلاً دلتا، ماتریس، مشتق یا delta"
          hide-details
          class="tw-my-4"
        />
        <div
          class="formula-categories"
          role="group"
          aria-label="دسته‌بندی نمادها"
        >
          <button
            type="button"
            :aria-pressed="category === 'all'"
            @click="
              category = 'all';
              search = '';
            "
          >
            همه نمادها
          </button>
          <button
            v-for="group in groups"
            :key="group.name"
            type="button"
            :aria-label="group.name"
            :aria-pressed="category === group.name"
            @click="
              category = group.name;
              search = '';
            "
          >
            {{ group.name
            }}<small>{{ group.items.length.toLocaleString("fa-IR") }}</small>
          </button>
        </div>
        <div
          v-for="group in filteredGroups"
          :key="group.name"
          class="formula-group"
        >
          <strong
            >{{ group.name
            }}<small
              >{{ group.items.length.toLocaleString("fa-IR") }} نماد و
              قالب</small
            ></strong
          >
          <div class="symbol-buttons" dir="ltr">
            <button
              v-for="item in group.items"
              :key="item.label"
              type="button"
              class="formula-symbol"
              :aria-label="item.label"
              :title="item.label"
              @mousedown.prevent
              @click="choose(item)"
            >
              <span v-html="item.html" /><small>{{ item.label }}</small>
            </button>
          </div>
        </div>
        <p v-if="!filteredGroups.length" class="formula-help">
          نمادی پیدا نشد. عبارت دیگری جستجو کنید.
        </p>
      </v-card-text>
      <v-card-actions
        ><v-btn
          color="primary"
          variant="flat"
          :disabled="
            !preview ||
            hasSlots ||
            !root.latex.trim() ||
            !!frames.length ||
            root.latex.length > 2000
          "
          @click="save"
          >درج فرمول</v-btn
        ><v-btn @click="emit('update:modelValue', false)"
          >انصراف</v-btn
        ></v-card-actions
      >
    </v-card>
  </v-dialog>
</template>
<style scoped>
.formula-input-label {
  display: grid;
  gap: 7px;
  margin: 14px 0;
  font-weight: 600;
}
.formula-code-input {
  width: 100%;
  border: 1px solid #aab9c6;
  border-radius: 7px;
  padding: 10px;
  background: white;
  font-family: monospace;
  font-size: 16px;
  resize: vertical;
}
.formula-parameters {
  padding: 16px;
  border: 1px solid #bdcbd6;
  border-radius: 10px;
  background: #f6f9fc;
  margin: 16px 0;
}
.formula-param-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.formula-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #c6d1dc;
  border-radius: 7px;
  background: white;
  cursor: pointer;
  font-size: 16px;
}
.formula-symbol:hover {
  background: #edf3f8;
  border-color: #2457d6;
}
.formula-symbol:focus-visible {
  outline: 2px solid #2457d6;
  outline-offset: 2px;
}
.symbol-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 18px;
}
.formula-preview {
  overflow-x: auto;
  min-height: 48px;
  padding: 12px;
}
.formula-group strong {
  display: block;
  margin-top: 12px;
}
@media (max-width: 540px) {
  .formula-param-grid {
    grid-template-columns: 1fr;
  }
}

.formula-dialog {
  background: #f6f8fc;
  border-radius: 24px !important;
  color: #172b49;
}
.formula-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 26px 26px 12px;
}
.formula-header-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border: 1px solid #d8e4fb;
  background: #e7efff;
  border-radius: 16px;
  color: #2457d6;
  flex-shrink: 0;
}
.formula-eyebrow {
  font-size: 10px;
  color: #62738b;
}
.formula-header h2 {
  font-size: 19px;
  line-height: 1.8;
  margin: 3px 0;
}
.formula-header p {
  font-size: 11px;
  line-height: 1.9;
  color: #62738b;
  margin: 0;
}
.formula-close {
  margin-inline-start: auto;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  background: white;
  color: #62738b;
  border-radius: 10px;
  flex-shrink: 0;
}
.formula-dialog :deep(.v-card-text) {
  padding: 12px 26px 24px;
}
.math-mode-tabs {
  display: inline-flex;
  gap: 4px;
  background: #e9eef7;
  padding: 4px;
  border-radius: 14px;
  margin: 0 0 18px;
}
.math-mode-tabs :deep(.v-btn) {
  font-size: 12px;
  min-height: 40px;
  border-radius: 10px;
}
.math-mode-tabs :deep(.v-btn--variant-tonal) {
  color: #2457d6;
  background: white;
}
.math-mode-tabs :deep(.v-btn__underlay) {
  display: none;
}
.formula-workspace {
  border: 1px solid #dce5f2;
  padding: 16px;
  border-radius: 20px;
  background: white;
}
.formula-workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.formula-workspace-heading strong {
  font-size: 12px;
}
.formula-tools {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.formula-tools button {
  min-width: 34px;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid #e0e7f1;
  background: #f7f9fc;
  border-radius: 9px;
  padding: 4px 8px;
  color: #536880;
  font: inherit;
  font-size: 11px;
}
.formula-tools button:hover {
  border-color: #c6d7fb;
  background: #edf3ff;
  color: #2457d6;
}
.math-host :deep(math-field) {
  min-height: 100px;
  border: 1px solid #d6e1f2;
  border-radius: 14px;
  background: #fafcff;
  padding: 20px 14px;
  font-size: 28px;
  transition: border-color 180ms ease;
}
.math-host :deep(math-field:focus-within) {
  border-color: #2457d6;
  outline: none;
}
.math-host :deep(math-field::part(virtual-keyboard-toggle)),
.math-host :deep(math-field::part(menu-toggle)) {
  display: none !important;
}
.formula-help {
  font-size: 11px;
  line-height: 1.9;
  color: #62738b;
  margin: 10px 0 0;
}
.formula-group {
  padding: 18px;
  margin-top: 14px;
  background: white;
  border: 1px solid #e0e7f1;
  border-radius: 18px;
}
.formula-group strong {
  font-size: 12px;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.formula-group strong small {
  font-size: 10px;
  font-weight: 400;
  color: #8491a4;
}
.symbol-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}
.formula-symbol {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-height: 76px;
  width: auto;
  min-width: 76px;
  max-width: 100%;
  flex: 0 0 auto;
  padding: 12px 8px;
  border: 1px solid #e0e7f1;
  border-radius: 12px;
  background: #fafbfd;
  color: #172b49;
  transition:
    background-color 160ms,
    border-color 160ms;
}
.formula-symbol > span {
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.formula-symbol small {
  max-width: 160px;
  overflow-wrap: anywhere;
  font-family: Dana, Vazirmatn, Arial, sans-serif;
  font-size: 10px;
  line-height: 1.6;
  color: #62738b;
  direction: rtl;
}
.formula-symbol:hover {
  background: #edf3ff;
  border-color: #a9bff0;
}
.formula-preview {
  background: white;
  border: 1px solid #e0e7f1;
  border-radius: 14px;
  margin-block: 12px;
  text-align: center;
}
.formula-parameters {
  border-radius: 18px;
  background: white;
  border: 1px solid #dce5f2;
}
.formula-parameters h3 {
  font-size: 14px;
}
.formula-dialog :deep(.v-card-actions) {
  border-top: 1px solid #dce3ed;
  background: white;
  padding: 16px 26px;
  gap: 8px;
}
.formula-dialog :deep(.v-card-actions .v-btn) {
  min-height: 44px;
  border-radius: 12px;
  padding-inline: 20px;
  font-size: 12px;
}
@media (max-width: 600px) {
  .formula-header {
    padding: 20px 16px 12px;
    gap: 10px;
  }
  .formula-header h2 {
    font-size: 15px;
  }
  .formula-header-icon {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }
  .formula-dialog :deep(.v-card-text) {
    padding: 8px 16px 20px;
  }
  .formula-dialog :deep(.v-card-actions) {
    padding: 12px 16px;
  }
  .formula-workspace {
    padding: 12px;
  }
  .formula-workspace-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .formula-group {
    padding: 14px;
  }
  .symbol-buttons {
    gap: 6px;
  }
  .formula-symbol {
    min-height: 70px;
    min-width: 68px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .formula-symbol,
  .math-host :deep(math-field) {
    transition: none;
  }
}
.formula-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-block: 16px;
}
.formula-categories button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #dce5f2;
  border-radius: 10px;
  background: white;
  color: #62738b;
  font: inherit;
  font-size: 11px;
  transition:
    background-color 160ms,
    border-color 160ms;
}
.formula-categories button[aria-pressed="true"] {
  background: #eaf1ff;
  color: #2457d6;
  border-color: #b8cbf5;
}
.formula-categories small {
  font-size: 9px;
  opacity: 0.7;
}
@media (max-width: 600px) {
  .formula-categories {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .formula-categories button {
    flex-shrink: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .formula-categories button {
    transition: none;
  }
}
</style>
