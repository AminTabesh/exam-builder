<script setup>
import { ref, computed } from "vue";
import { mathErrors, mathSegments } from "@exam/shared/math.js";
import FormulaDialog from "./FormulaDialog.vue";
import MathText from "./MathText.vue";
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: String,
  errorMessages: [String, Array],
  hideDetails: [Boolean, String],
  density: String,
  multiline: Boolean,
  autoGrow: Boolean,
  noResize: Boolean,
  rows: { type: [Number, String], default: 3 },
  hint: String,
  persistentHint: Boolean,
  maxlength: { type: [Number, String], default: 2000 },
});
const emit = defineEmits(["update:modelValue"]);
const field = ref(null),
  dialog = ref(false),
  initial = ref("");
let selection = { start: 0, end: 0 };
const hasMath = computed(() =>
  mathSegments(props.modelValue).some((s) => s.latex !== undefined),
);
const errors = computed(() => [
  ...[props.errorMessages].flat().filter(Boolean),
  ...mathErrors(props.modelValue),
]);
function remember(event) {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  )
    selection = {
      start: event.target.selectionStart ?? 0,
      end: event.target.selectionEnd ?? 0,
    };
}
function openFormula() {
  initial.value = "";
  dialog.value = true;
}
function insert(latex) {
  const { start, end } = selection;
  const text =
    props.modelValue.slice(0, start) +
    `$${latex}$` +
    props.modelValue.slice(end);
  emit("update:modelValue", text);
  selection = {
    start: start + latex.length + 2,
    end: start + latex.length + 2,
  };
}
</script>
<template>
  <div
    class="math-text-field"
    @input.capture="remember"
    @select.capture="remember"
    @click.capture="remember"
    @keyup.capture="remember"
    @focusout="remember"
  >
    <component
      :is="multiline ? 'v-textarea' : 'v-text-field'"
      :rows="multiline ? rows : undefined"
      :auto-grow="multiline && autoGrow"
      :no-resize="multiline && noResize"
      :hint="hint"
      :persistent-hint="persistentHint"
      ref="field"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :label="label"
      :error-messages="errors"
      :hide-details="errors.length ? false : hideDetails"
      :density="density"
      :maxlength="maxlength"
    />
    <v-btn
      variant="text"
      size="small"
      :aria-label="'افزودن فرمول به ' + label"
      @mousedown.prevent
      @click="openFormula"
      >＋ فرمول</v-btn
    >
    <div
      v-if="hasMath"
      class="math-field-preview"
      :aria-label="'پیش‌نمایش ' + label"
    >
      <MathText :value="modelValue" />
    </div>
    <FormulaDialog v-model="dialog" :initial="initial" @save="insert" />
  </div>
</template>
<style scoped>
.math-text-field {
  min-width: 0;
  flex: 1;
}
.math-field-preview {
  padding: 10px 12px;
  background: #f5f8fb;
  border: 1px solid #dde5ec;
  border-radius: 7px;
  overflow-wrap: anywhere;
  overflow-x: auto;
  line-height: 2;
  white-space: pre-wrap;
}
</style>
