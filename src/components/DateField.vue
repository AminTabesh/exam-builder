<script setup>
import { computed, ref, watch, nextTick, useId } from "vue";
import { useEventListener } from "@vueuse/core";
import DatePicker from "vue3-persian-datetime-picker";
import { parseDate, convertDate, dateFormat } from "../../shared/date.js";
const props = defineProps({ modelValue: String, calendar: String });
const emit = defineEmits(["update:modelValue"]);
const show = ref(false),
  field = ref(null),
  id = useId();
const invalid = computed(
  () => !!props.modelValue && !parseDate(props.modelValue, props.calendar),
);
const selected = computed(() => (invalid.value ? "" : props.modelValue));
watch(
  () => props.calendar,
  (to, from) =>
    emit("update:modelValue", convertDate(props.modelValue, from, to)),
);
async function close() {
  show.value = false;
  await nextTick();
  field.value?.querySelector("input")?.focus();
}
useEventListener(
  document,
  "keydown",
  (event) => {
    if (show.value && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  },
  { capture: true },
);
</script>
<template>
  <div ref="field">
    <v-text-field
      :id="id"
      :model-value="modelValue"
      label="تاریخ آزمون (اختیاری)"
      readonly
      :error-messages="
        invalid
          ? 'تاریخ قبلی معتبر نیست؛ آن را پاک کنید یا روز صحیح را انتخاب کنید.'
          : ''
      "
      hint="برای انتخاب تاریخ باز کنید"
      persistent-hint
      :aria-expanded="show"
      aria-haspopup="dialog"
      @click="show = true"
      @keydown.enter.prevent="show = true"
      @keydown.space.prevent="show = true"
      @keydown.arrow-down.prevent="show = true"
    />
    <v-btn
      variant="text"
      size="small"
      :disabled="!modelValue"
      @click="emit('update:modelValue', '')"
      >پاک کردن تاریخ</v-btn
    >
    <DatePicker
      :key="calendar"
      :model-value="selected"
      :show="show"
      custom-input=".date-picker-hidden-trigger"
      :locale="calendar === 'jalali' ? 'fa' : 'en'"
      :locale-config="{
        en: {
          lang: {
            label: 'میلادی',
            submit: 'تأیید',
            cancel: 'انصراف',
            now: 'امروز',
            nextMonth: 'ماه بعد',
            prevMonth: 'ماه قبل',
            year: 'سال',
            month: 'ماه',
            day: 'روز',
          },
        },
      }"
      :format="dateFormat(calendar)"
      :display-format="dateFormat(calendar)"
      @update:model-value="emit('update:modelValue', $event)"
      @close="close"
    />
  </div>
</template>
