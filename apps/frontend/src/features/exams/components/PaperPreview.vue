<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import PrintDocument from "@exam/shared/PrintDocument";
import { paginate } from "@exam/shared/paginate";
const monochrome = ref(false);
const props = defineProps({
    exam: Object,
    kind: { default: "student" },
    interactive: Boolean,
  }),
  emit = defineEmits(["error", "pages"]),
  root = ref(null),
  scale = ref(0.55),
  height = ref(650),
  busy = ref(false),
  error = ref("");
const zoom = ref(1),
  page = ref(1),
  pageCount = ref(1),
  scroll = ref(null),
  selectedKind = ref(props.kind);
const effectiveScale = computed(() => scale.value * zoom.value);
function goPage(delta) {
  page.value = Math.max(1, Math.min(pageCount.value, page.value + delta));
  scroll.value?.scrollTo({
    top: (page.value - 1) * (1122.52 * effectiveScale.value + 18),
    behavior: "smooth",
  });
}
watch(
  () => props.kind,
  (value) => (selectedKind.value = value),
);
let observer,
  timer,
  generation = 0;
async function render() {
  const version = ++generation;
  busy.value = true;
  await nextTick();
  try {
    const doc = root.value?.querySelector(".print-document");
    if (!doc || !root.value.clientWidth) return;
    const pages = await paginate(
      doc,
      props.exam.meta.title,
      props.exam.layout.language,
    );
    if (version !== generation) return;
    scale.value = Math.max(
      0.1,
      Math.min(1, (root.value.clientWidth - 2) / 793.7),
    );
    height.value = pages * 1122.52 * scale.value + (pages - 1) * 18;
    pageCount.value = pages;
    emit("pages", pages);
    error.value = "";
    emit("error", "");
  } catch (e) {
    error.value = e.message;
    emit("error", e.message);
  } finally {
    busy.value = false;
  }
}
watch(
  () => [props.exam, selectedKind.value],
  () => {
    clearTimeout(timer);
    timer = setTimeout(render, 350);
  },
  { deep: true },
);
onMounted(() => {
  observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(render, 100);
  });
  observer.observe(root.value);
  render();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  observer?.disconnect();
  generation++;
});
</script>
<template>
  <div ref="root" class="paper-preview">
    <nav
      v-if="interactive"
      class="preview-controls"
      aria-label="کنترل پیش‌نمایش"
    >
      <select v-model="selectedKind" aria-label="نوع برگه">
        <option value="student">دانش‌آموز</option>
        <option value="answer-key">پاسخ‌نامه</option>
      </select>
      <button @click="zoom = 1">اندازه صفحه</button
      ><button aria-label="بزرگ‌نمایی" @click="zoom = Math.min(3, zoom + 0.25)">
        ＋</button
      ><button aria-label="کوچک‌نمایی" @click="zoom = Math.max(1, zoom - 0.25)">
        −
      </button>
      <button :disabled="page === 1" @click="goPage(-1)">صفحه قبل</button
      ><span
        >{{ page.toLocaleString("fa-IR") }} /
        {{ pageCount.toLocaleString("fa-IR") }}</span
      ><button :disabled="page === pageCount" @click="goPage(1)">
        صفحه بعد
      </button>
    </nav>
    <label class="preview-monochrome"
      ><input type="checkbox" v-model="monochrome" /> پیش‌نمایش سیاه و
      سفید</label
    >
    <v-alert v-if="error" type="error" density="compact">{{ error }}</v-alert>
    <div
      ref="scroll"
      class="preview-scroll"
      :style="interactive ? { maxHeight: '70dvh' } : {}"
    >
      <div
        class="preview-scaler"
        :class="{ monochrome }"
        :style="{
          height: height * zoom + 'px',
          width: interactive ? 793.7 * effectiveScale + 'px' : '100%',
        }"
      >
        <div
          :style="{
            transform: `scale(${effectiveScale})`,
            transformOrigin: 'top right',
            width: '793.7px',
          }"
        >
          <PrintDocument :exam="exam" :kind="selectedKind" />
        </div>
      </div>
    </div>
    <span v-if="busy" class="preview-working">در حال چیدمان…</span>
  </div>
</template>
