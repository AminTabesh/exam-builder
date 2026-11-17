<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, useExams } from "../../exams/store.js";
const route = useRoute(),
  router = useRouter(),
  store = useExams(),
  order = ref(null),
  error = ref(""),
  busy = ref(false);
async function confirm() {
  busy.value = true;
  error.value = "";
  try {
    order.value = await api(`/billing/orders/${route.params.id}/mock-confirm`, {
      method: "POST",
    });
    await store.refreshBilling();
    store.notice = "خرید آزمایشی موفق بود؛ طرح شما فعال شد.";
    await router.replace("/pricing?purchase=success");
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    order.value = await api("/billing/orders/" + route.params.id);
    await confirm();
  } catch (e) {
    error.value = e.message;
  }
});
</script>
<template>
  <section class="checkout-page">
    <span class="eyebrow">درگاه آزمایشی</span>
    <h1>در حال تأیید خرید شما…</h1>
    <p>این پرداخت شبیه‌سازی شده است و هیچ مبلغی از شما دریافت نمی‌شود.</p>
    <p v-if="order">
      مبلغ نمایشی: {{ (order.price / 10).toLocaleString("fa-IR") }} تومان
    </p>
    <v-progress-circular v-if="busy" indeterminate color="primary" /><v-alert
      v-if="error"
      type="error"
      >{{ error }}</v-alert
    ><v-btn v-if="error" @click="confirm" :loading="busy">تلاش دوباره</v-btn
    ><v-btn variant="text" to="/pricing">بازگشت به طرح‌ها</v-btn>
  </section>
</template>
