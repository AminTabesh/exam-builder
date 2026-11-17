<script setup>
import { computed, ref, useId, nextTick } from "vue";
import { useEventListener } from "@vueuse/core";
import DatePicker from "vue3-persian-datetime-picker";
import moment from "moment-jalaali";
const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
const show = ref(false),
  field = ref(null),
  id = useId();
const selected = computed(() =>
  props.modelValue && moment(props.modelValue).isValid()
    ? moment(props.modelValue).locale("en").format("YYYY-MM-DD HH:mm")
    : "",
);
const display = computed(() =>
  selected.value
    ? moment(props.modelValue).locale("fa").format("jYYYY/jMM/jDD HH:mm")
    : "",
);
function update(value) {
  if (!value) {
    emit("update:modelValue", "");
    return;
  }
  const date = moment(value, "YYYY-MM-DD HH:mm", "en", true);
  if (date.isValid()) emit("update:modelValue", date.toISOString());
}
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
  <div ref="field" class="admin-datetime-field">
    <v-text-field
      :id="id"
      :model-value="display"
      :label="label"
      readonly
      clearable
      hide-details
      :aria-expanded="show"
      aria-haspopup="dialog"
      @click="show = true"
      @keydown.enter.prevent="show = true"
      @keydown.space.prevent="show = true"
      @keydown.arrow-down.prevent="show = true"
      @click:clear.stop="emit('update:modelValue', '')"
    />
    <DatePicker
      :model-value="selected"
      :show="show"
      type="datetime"
      locale="fa"
      format="YYYY-MM-DD HH:mm"
      display-format="jYYYY/jMM/jDD HH:mm"
      color="#15803d"
      :custom-input="'#admin-picker-trigger-' + id"
      @update:model-value="update"
      @close="close"
    />
  </div>
</template>
<style scoped>
.admin-datetime-field {
  min-width: 0;
}
.admin-datetime-field :deep(input) {
  direction: ltr;
  text-align: right;
  cursor: pointer;
}
</style>
