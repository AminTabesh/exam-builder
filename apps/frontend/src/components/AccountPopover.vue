<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useId } from "vue";
import { persianDigits as fa } from "../lib/numbers.js";
const props = defineProps({
  name: { type: String, default: "" },
  plan: { type: String, default: "حساب شخصی" },
  remaining: { type: Number, default: null },
  limit: { type: Number, default: null },
  days: { type: Number, default: null },
  dayPercent: { type: Number, default: 0 },
  loading: Boolean,
  canLogout: Boolean,
});
const emit = defineEmits(["logout"]);
const open = ref(false),
  root = ref(null),
  trigger = ref(null),
  id = useId();
const initial = computed(() => Array.from(props.name.trim())[0] || "");
const examPercent = computed(() =>
  props.limit
    ? Math.max(0, Math.min(100, (100 * (props.remaining || 0)) / props.limit))
    : 100,
);
function close() {
  open.value = false;
}
function outside(e) {
  if (!root.value?.contains(e.target)) close();
}
function escape(e) {
  if (e.key === "Escape" && open.value) {
    close();
    trigger.value?.focus();
  }
}
function blur(e) {
  if (!root.value?.contains(e.relatedTarget)) close();
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <div ref="root" class="account-popover" @keydown="escape" @focusout="blur">
    <button
      ref="trigger"
      class="account-trigger"
      :aria-expanded="open"
      :aria-controls="id"
      @click="open = !open"
    >
      <b>{{ name || "حساب کاربری" }}</b
      ><span class="account-avatar" aria-hidden="true">{{
        initial
      }}</span></button
    ><Transition name="account-panel"
      ><section
        v-if="open"
        :id="id"
        class="account-panel"
        aria-label="جزئیات حساب کاربری"
      >
        <header>
          <span class="account-avatar" aria-hidden="true">{{ initial }}</span>
          <div>
            <h2>{{ name }}</h2>
            <p>{{ plan }}</p>
          </div>
        </header>
        <p v-if="loading" role="status">در حال دریافت وضعیت اشتراک…</p>
        <div v-else class="usage-grid">
          <div class="usage-item">
            <div class="usage-ring">
              <v-progress-circular
                :model-value="examPercent"
                :size="60"
                :width="5"
                color="primary"
                aria-hidden="true"
                >{{
                  remaining === null ? "∞" : fa(remaining)
                }}</v-progress-circular
              >
            </div>
            <b>آزمون باقی‌مانده</b
            ><small>{{
              remaining === null
                ? "ساخت نامحدود"
                : `${fa(remaining)} از ${fa(limit)} آزمون`
            }}</small>
          </div>
          <div class="usage-item">
            <div class="usage-ring">
              <v-progress-circular
                :model-value="dayPercent"
                :size="60"
                :width="5"
                color="primary"
                aria-hidden="true"
                >{{ days === null ? "—" : fa(days) }}</v-progress-circular
              >
            </div>
            <b>زمان اشتراک</b
            ><small>{{
              days === null ? "بدون تاریخ انقضا" : `${fa(days)} روز باقی‌مانده`
            }}</small>
          </div>
        </div>
        <nav>
          <router-link to="/account" @click="close">مدیریت حساب</router-link
          ><router-link to="/pricing" @click="close"
            >مشاهده و تمدید طرح</router-link
          ><button
            v-if="canLogout"
            @click="
              close();
              emit('logout');
            "
          >
            خروج از حساب
          </button>
        </nav>
      </section></Transition
    >
  </div>
</template>
<style scoped>
.account-popover {
  position: relative;
  direction: rtl;
  margin-inline-start: auto;
  color: #172b49;
  font-family: Dana, Vazirmatn, Arial, sans-serif;
}
.account-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.account-trigger:hover,
.account-trigger[aria-expanded="true"] {
  background: #edf2fb;
}
.account-trigger b {
  font-size: 13px;
}
.account-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #e1eafb;
  color: #102a56;
  font-size: 16px;
  flex-shrink: 0;
}
.account-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: min(320px, calc(100vw - 32px));
  padding: 20px;
  background: white;
  border: 1px solid #dce3ed;
  border-radius: 12px;
  box-shadow: 0 16px 50px #102a5626;
  z-index: 100;
}
.account-panel header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e4eaf2;
}
.account-panel h2 {
  font-size: 15px;
  margin: 0;
}
.account-panel p {
  font-size: 12px;
  color: #62738b;
  margin: 4px 0 0;
}
.usage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 20px 0;
}
.usage-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.usage-item b {
  font-size: 12px;
}
.usage-item small {
  font-size: 11px;
  color: #62738b;
}
.usage-ring {
  font-size: 16px;
  margin-bottom: 4px;
}
.account-panel nav {
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e4eaf2;
  padding-top: 8px;
}
.account-panel nav a,
.account-panel nav button {
  padding: 12px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: right;
  color: #245be7;
  font: inherit;
  font-size: 13px;
  min-height: 44px;
  text-decoration: none;
}
.account-panel nav a:hover,
.account-panel nav button:hover {
  background: #edf2fb;
}
.account-popover :focus-visible:not(input, textarea) {
  outline: 3px solid #729aff;
  outline-offset: 2px;
}
.account-panel-enter-active,
.account-panel-leave-active {
  transition:
    opacity 0.16s,
    transform 0.16s;
}
.account-panel-enter-from,
.account-panel-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
@media (prefers-reduced-motion: reduce) {
  .account-panel-enter-active,
  .account-panel-leave-active {
    transition: none;
  }
}
</style>
