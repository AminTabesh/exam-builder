<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import PrintDocument from "../../shared/PrintDocument";
import { paginate } from "../../shared/paginate";
const props = defineProps({ exam: Object, kind: { default: "student" } }),
  emit = defineEmits(["error", "pages"]),
  root = ref(null),
  scale = ref(0.55),
  height = ref(650),
  busy = ref(false),
  error = ref("");
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
  () => [props.exam, props.kind],
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
    <v-alert v-if="error" type="error" density="compact">{{ error }}</v-alert>
    <div class="preview-scaler" :style="{ height: height + 'px' }">
      <div
        :style="{
          transform: `scale(${scale})`,
          transformOrigin: 'top right',
          width: '793.7px',
        }"
      >
        <PrintDocument :exam="exam" :kind="kind" />
      </div>
    </div>
    <span v-if="busy" class="preview-working">در حال چیدمان…</span>
  </div>
</template>
