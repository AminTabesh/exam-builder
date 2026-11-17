<script setup>
import { computed } from "vue";
import { mathSegments, renderFormula } from "@exam/shared/math.js";
const props = defineProps({ value: String });
const parts = computed(() =>
  mathSegments(props.value).map((p) => {
    if (p.latex === undefined) return p;
    try {
      return { ...p, html: renderFormula(p.latex) };
    } catch {
      return { ...p, invalid: true };
    }
  }),
);
</script>
<template>
  <span class="math-text"
    ><template v-for="(part, i) in parts" :key="i"
      ><span
        v-if="part.html"
        class="formula"
        dir="ltr"
        v-html="part.html"
      /><span v-else-if="part.invalid" class="text-error" dir="ltr">{{
        part.latex
      }}</span
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>
