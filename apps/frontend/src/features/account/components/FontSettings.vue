<script setup>
import { ref, computed } from "vue";
import { bundledFonts, defaultFont } from "@exam/shared/fonts.js";
import { api, useExams } from "../../exams/store.js";
const props = defineProps({ modelValue: String });
const emit = defineEmits(["update:modelValue"]);
const store = useExams(),
  license = ref(false),
  busy = ref(false),
  error = ref(""),
  fileInput = ref(null);
const options = computed(() => [
  ...bundledFonts.map((font) => ({ title: font.name, value: font.id })),
  ...store.fonts.map((font) => ({
    title: `${font.name} · شخصی`,
    value: font.id,
  })),
]);
async function upload(event) {
  const file = event.target.files[0];
  if (!file) return;
  busy.value = true;
  error.value = "";
  try {
    if (!license.value || file.size > 5 * 1024 * 1024)
      throw new Error(
        "مجوز استفاده را تأیید کنید و فایل حداکثر ۵ مگابایت انتخاب کنید.",
      );
    const form = new FormData();
    form.append("font", file);
    form.append("licenseConfirmed", "true");
    const font = await api("/fonts", { method: "POST", body: form });
    store.fonts.push(font);
    emit("update:modelValue", font.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    event.target.value = "";
  }
}
async function remove(font) {
  busy.value = true;
  error.value = "";
  try {
    await api("/fonts/" + font.id, { method: "DELETE" });
    store.fonts = store.fonts.filter((row) => row.id !== font.id);
    if (props.modelValue === font.id) emit("update:modelValue", defaultFont);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="font-settings">
    <v-select
      :model-value="modelValue || defaultFont"
      @update:model-value="emit('update:modelValue', $event)"
      :items="options"
      label="فونت آزمون"
    />
    <details>
      <summary>فونت شخصی من</summary>
      <p class="field-hint">
        TTF یا OTF، حداکثر ۵ مگابایت؛ تا ده فونت خصوصی در حساب شما.
      </p>
      <v-checkbox
        v-model="license"
        label="مجوز استفاده و قراردادن این فونت در PDF را دارم."
      /><v-btn
        variant="outlined"
        :disabled="!license || busy"
        :loading="busy"
        @click="fileInput.click()"
        >بارگذاری فونت</v-btn
      ><input
        ref="fileInput"
        type="file"
        accept=".ttf,.otf"
        hidden
        @change="upload"
      />
      <ul v-if="store.fonts.length" class="font-list">
        <li v-for="font in store.fonts" :key="font.id">
          <span>{{ font.name }}</span
          ><v-btn
            size="small"
            variant="text"
            color="error"
            :disabled="busy"
            @click="remove(font)"
            >حذف فونت</v-btn
          >
        </li>
      </ul>
    </details>
    <v-alert v-if="error" type="error" class="tw-my-3">{{ error }}</v-alert>
  </div>
</template>
