<script setup>
import { computed } from "vue";
const props = defineProps({
  value: Number,
  limit: Number,
  unlimited: Boolean,
  label: String,
  detail: String,
  unit: String,
  tone: { type: String, default: "blue" },
});
const percent = computed(() =>
  props.unlimited
    ? 100
    : Math.max(
        0,
        Math.min(100, props.limit > 0 ? (props.value / props.limit) * 100 : 0),
      ),
);
</script>
<template>
  <div class="usage-metric" :class="`usage-metric--${tone}`">
    <div
      class="usage-donut"
      role="img"
      :aria-label="`${label}: ${unlimited ? 'نامحدود' : value.toLocaleString('fa-IR') + ' ' + unit}`"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="usage-track" cx="50" cy="50" r="42" />
        <circle
          class="usage-progress"
          cx="50"
          cy="50"
          r="42"
          pathLength="100"
          :stroke-dasharray="`${percent} 100`"
        />
      </svg>
      <div class="usage-donut-value">
        <b>{{ unlimited ? "∞" : value.toLocaleString("fa-IR") }}</b
        ><small>{{ unit }}</small>
      </div>
    </div>
    <div class="usage-metric-copy">
      <h3>{{ label }}</h3>
      <p>{{ detail }}</p>
    </div>
  </div>
</template>
