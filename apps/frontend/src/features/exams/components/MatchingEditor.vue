<script setup>
import { matchingLabel } from "@exam/shared/matching.js";
import { uid, paragraph } from "@exam/shared/exam.js";
import RichEditor from "./RichEditor.vue";
import Icon from "../../../components/Icon.vue";
const props = defineProps({
  modelValue: { type: Object, required: true },
  language: { type: String, default: "fa" },
});
const emit = defineEmits(["update:modelValue"]);
const sides = [
  { id: "left", label: "ستون اول" },
  { id: "right", label: "ستون دوم" },
];
function update(side, id, body) {
  emit("update:modelValue", {
    ...props.modelValue,
    [side]: props.modelValue[side].map((item) =>
      item.id === id ? { ...item, body } : item,
    ),
  });
}
function add(side) {
  if (props.modelValue[side].length >= 12) return;
  emit("update:modelValue", {
    ...props.modelValue,
    [side]: [...props.modelValue[side], { id: uid(), body: paragraph("") }],
  });
}
function remove(side, id) {
  emit("update:modelValue", {
    ...props.modelValue,
    [side]: props.modelValue[side].filter((item) => item.id !== id),
    pairs: props.modelValue.pairs.filter(
      (pair) => pair.leftId !== id && pair.rightId !== id,
    ),
  });
}
function pair(leftId, rightId) {
  const pairs = props.modelValue.pairs.filter((pair) => pair.leftId !== leftId);
  if (rightId) pairs.push({ leftId, rightId });
  emit("update:modelValue", { ...props.modelValue, pairs });
}
</script>
<template>
  <section class="matching-editor" aria-label="ستون‌های سؤال وصل‌کردنی">
    <p class="matching-hint">
      تعداد موارد دو ستون می‌تواند متفاوت باشد. متن، فرمول، جای خالی، تصویر و
      شکل اضافه کنید. دانش‌آموز موارد مرتبط را با خط وصل می‌کند.
    </p>
    <div class="matching-columns">
      <section v-for="side in sides" :key="side.id" :aria-label="side.label">
        <header>
          <h3>{{ side.label }}</h3>
          <button
            type="button"
            :disabled="modelValue[side.id].length >= 12"
            @click="add(side.id)"
          >
            <Icon name="plus" :size="17" /> افزودن مورد به {{ side.label }}
          </button>
        </header>
        <article
          v-for="(item, index) in modelValue[side.id]"
          :key="item.id"
          class="matching-edit-item"
        >
          <div class="matching-item-toolbar">
            <b>{{ matchingLabel(side.id, index, language) }}</b
            ><button
              type="button"
              :aria-label="`حذف مورد ${matchingLabel(side.id, index, language)} از ${side.label}`"
              @click="remove(side.id, item.id)"
            >
              <Icon name="trash" :size="18" />
            </button>
          </div>
          <RichEditor
            :model-value="item.body"
            @update:model-value="update(side.id, item.id, $event)"
            :label="`مورد ${matchingLabel(side.id, index, language)} · ${side.label}`"
            compact
            allow-blank
          />
        </article>
        <p v-if="!modelValue[side.id].length" class="matching-hint">
          یک مورد به این ستون اضافه کنید.
        </p>
      </section>
    </div>
    <details class="matching-answer-settings">
      <summary>اتصال‌های صحیح (فقط پاسخ‌نامه مدرس)</summary>
      <p class="matching-hint">
        برای هر مورد ستون اول، پاسخ ستون دوم را انتخاب کنید. موارد اضافه
        می‌توانند بدون اتصال بمانند. اتصال‌ها در نسخه دانش‌آموز نمایش داده
        نمی‌شوند.
      </p>
      <label v-for="(item, index) in modelValue.left" :key="item.id"
        ><span>مورد {{ matchingLabel("left", index, language) }} ←</span
        ><select
          :aria-label="`پاسخ مورد ${matchingLabel('left', index, language)}`"
          :value="
            modelValue.pairs.find((pair) => pair.leftId === item.id)?.rightId ||
            ''
          "
          @change="pair(item.id, $event.target.value)"
        >
          <option value="">بدون اتصال</option>
          <option
            v-for="(target, targetIndex) in modelValue.right"
            :key="target.id"
            :value="target.id"
            :disabled="
              modelValue.pairs.some(
                (pair) => pair.rightId === target.id && pair.leftId !== item.id,
              )
            "
          >
            مورد {{ matchingLabel("right", targetIndex, language) }}
          </option>
        </select></label
      >
    </details>
  </section>
</template>
<style scoped>
.matching-editor {
  margin: 20px 0;
}
.matching-hint {
  font-size: 12px;
  line-height: 2;
  color: #62738b;
  margin: 14px 0;
}
.matching-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 18px;
}
.matching-columns > section {
  min-width: 0;
}
.matching-columns header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  border-bottom: 1px solid #dce3ed;
  padding-bottom: 12px;
}
.matching-columns h3 {
  font-size: 15px;
}
.matching-editor button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 44px;
  padding: 8px;
  border: 0;
  border-radius: 7px;
  background: #edf3ff;
  color: #245be7;
  font: inherit;
  font-size: 11px;
}
.matching-edit-item {
  border: 1px solid #dce3ed;
  border-radius: 10px;
  padding: 12px;
  margin-top: 14px;
  background: #fbfcff;
}
.matching-item-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.matching-item-toolbar b {
  font-size: 14px;
  color: #245be7;
}
.matching-item-toolbar button {
  background: transparent;
  color: #62738b;
}
.matching-answer-settings {
  margin-top: 22px;
  border: 1px solid #dce3ed;
  border-radius: 10px;
  padding: 14px;
}
.matching-answer-settings summary {
  cursor: pointer;
  font-size: 13px;
  min-height: 32px;
}
.matching-answer-settings label {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 12px 0;
  font-size: 13px;
}
.matching-answer-settings select {
  border: 1px solid #c8d5e7;
  border-radius: 7px;
  min-height: 44px;
  padding: 8px 14px;
  min-width: 140px;
  background: white;
}
.matching-editor :deep(.tiptap) {
  min-height: 75px;
}
.matching-editor :focus-visible:not(input, textarea) {
  outline: 3px solid #729aff;
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .matching-columns {
    grid-template-columns: 1fr;
  }
  .matching-columns header {
    flex-wrap: wrap;
  }
}
</style>
