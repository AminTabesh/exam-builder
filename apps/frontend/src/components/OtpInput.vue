<script setup>
import { ref, nextTick, onMounted } from "vue";
import { englishDigits } from "../lib/numbers.js";
const props = defineProps({
  modelValue: { type: String, default: "" },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const inputs = ref([]);
const normalize = (value) => englishDigits(value).replace(/[^0-9]/g, "");
function enter(event, index) {
  const value = normalize(event.target.value);
  const digits = props.modelValue.padEnd(6, " ").split("");
  if (value.length > 1) {
    emit("update:modelValue", value.slice(0, 6));
    nextTick(() => inputs.value[Math.min(value.length, 5)]?.focus());
  } else {
    digits[index] = value || " ";
    emit("update:modelValue", digits.join(""));
    if (value) inputs.value[Math.min(index + 1, 5)]?.focus();
  }
  event.target.value = value.slice(-1);
}
function paste(event) {
  const value = normalize(event.clipboardData.getData("text")).slice(0, 6);
  emit("update:modelValue", value);
  nextTick(() => inputs.value[Math.min(value.length, 5)]?.focus());
}
function key(event, index) {
  if (event.key === "Backspace") {
    event.preventDefault();
    const digits = props.modelValue.padEnd(6, " ").split("");
    digits[event.target.value ? index : Math.max(0, index - 1)] = " ";
    emit("update:modelValue", digits.join(""));
    inputs.value[event.target.value ? index : Math.max(0, index - 1)]?.focus();
  }
  if (event.key === "ArrowLeft") inputs.value[Math.max(0, index - 1)]?.focus();
  if (event.key === "ArrowRight") inputs.value[Math.min(5, index + 1)]?.focus();
}
onMounted(() => inputs.value[0]?.focus());
</script>
<template>
  <fieldset class="otp-inputs" dir="ltr">
    <legend>کد شش‌رقمی</legend>
    <input
      v-for="(_, i) in 6"
      :key="i"
      :ref="(el) => (inputs[i] = el)"
      :value="(modelValue[i] || '').trim()"
      :aria-label="i === 0 ? 'کد شش‌رقمی' : `رقم ${i + 1}`"
      :autocomplete="i === 0 ? 'one-time-code' : 'off'"
      inputmode="numeric"
      :disabled="disabled"
      @input="enter($event, i)"
      @paste.prevent="paste"
      @keydown="key($event, i)"
      @focus="$event.target.select()"
    />
  </fieldset>
</template>
