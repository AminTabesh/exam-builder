<script setup>
import { computed } from "vue";
import { persianDigits } from "../lib/numbers.js";
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  label: { type: String, required: true },
  unit: { type: String, default: "" },
  persian: { type: Boolean, default: true },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue", "change"]);
const percent = computed(() =>
  Math.max(
    0,
    Math.min(
      100,
      (100 * (props.modelValue - props.min)) / (props.max - props.min || 1),
    ),
  ),
);
const format = (value) =>
  props.persian ? persianDigits(value) : String(value);
function input(event, commit = false) {
  const value = Number(event.target.value);
  emit("update:modelValue", value);
  if (commit) emit("change", value);
}
</script>
<template>
  <label class="app-slider" :class="{ 'app-slider--disabled': disabled }">
    <span class="app-slider__heading"
      ><span>{{ label }}</span
      ><output dir="ltr"
        >{{ format(modelValue) }} <span>{{ unit }}</span></output
      ></span
    >
    <input
      type="range"
      :aria-label="label"
      :aria-valuetext="`${format(modelValue)} ${unit}`"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--slider-fill': `${percent}%` }"
      dir="ltr"
      @input="input($event)"
      @change="input($event, true)"
    />
    <span class="app-slider__limits" dir="ltr"
      ><span>{{ format(min) }}</span
      ><span>{{ format(max) }}</span></span
    >
  </label>
</template>
<style scoped>
.app-slider {
  display: grid;
  gap: 6px;
  min-width: 150px;
  width: 100%;
  color: var(--ink, #172b4d);
}
.app-slider__heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  font-weight: 600;
}
.app-slider output {
  background: #edf3ff;
  border: 1px solid #d9e5ff;
  color: var(--navy, #2457d6);
  border-radius: 7px;
  min-width: 48px;
  text-align: center;
  padding: 3px 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.app-slider output span {
  font-size: 10px;
}
.app-slider input {
  appearance: none;
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  cursor: pointer;
  background: transparent;
  margin: 0;
  border: 0;
  padding: 0;
}
.app-slider input::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9px;
  background: linear-gradient(
    to right,
    var(--navy, #2457d6) var(--slider-fill),
    #e1e8f4 var(--slider-fill)
  );
}
.app-slider input::-moz-range-track {
  height: 6px;
  border-radius: 9px;
  background: #e1e8f4;
}
.app-slider input::-moz-range-progress {
  height: 6px;
  border-radius: 9px;
  background: var(--navy, #2457d6);
}
.app-slider input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border: 3px solid white;
  border-radius: 50%;
  background: var(--navy, #2457d6);
  box-shadow: 0 1px 5px #172b4d40;
  margin-top: -7px;
}
.app-slider input::-moz-range-thumb {
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 3px solid white;
  border-radius: 50%;
  background: var(--navy, #2457d6);
  box-shadow: 0 1px 5px #172b4d40;
}
.app-slider input:focus-visible {
  outline: 2px solid var(--navy, #2457d6);
  outline-offset: 3px;
  border-radius: 8px;
}
.app-slider__limits {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--muted, #586980);
}
.app-slider--disabled {
  opacity: 0.5;
}
.app-slider--disabled input {
  cursor: not-allowed;
}
</style>
