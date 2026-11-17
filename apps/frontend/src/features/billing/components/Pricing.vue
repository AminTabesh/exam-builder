<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import UsageDonut from "./UsageDonut.vue";
import { useRouter } from "vue-router";
import { api, useExams } from "../../exams/store.js";
import Icon from "../../../components/Icon.vue";
import { native, BazaarBilling } from "../../../platform/api.js";
const providerProducts = ref({}),
  skuMap = ref({}),
  subscription = ref(null),
  capabilities = ref({ mock: false }),
  bazaarReady = ref(false);
const store = useExams(),
  router = useRouter(),
  plans = ref([]),
  loading = ref(true),
  error = ref(""),
  busy = ref("");
const now = ref(Date.now());
let clock;
onMounted(() => {
  clock = setInterval(() => {
    now.value = Date.now();
  }, 60000);
});
onBeforeUnmount(() => clearInterval(clock));
const daysLeft = computed(
  () =>
    Math.max(
      0,
      Math.ceil(
        (new Date(store.billing?.expiresAt).getTime() - now.value) / 86400000,
      ),
    ) || 0,
);
const subscriptionDays = computed(
  () =>
    Math.max(
      daysLeft.value,
      Math.ceil(
        (new Date(store.billing?.expiresAt).getTime() -
          new Date(store.billing?.periodStartsAt).getTime()) /
          86400000,
      ),
    ) || 1,
);
onMounted(async () => {
  try {
    plans.value = await api("/plans");
    capabilities.value = await api("/billing/capabilities");
    if (store.user) subscription.value = await api("/billing/bazaar/status");
    if (native) {
      const catalog = await api("/billing/bazaar/products");
      skuMap.value = catalog.products;
      if (catalog.available) {
        const result = await BazaarBilling.products({
          productIds: Object.values(catalog.products).filter(Boolean),
        });
        providerProducts.value = Object.fromEntries(
          result.products.map((p) => [p.productId, p]),
        );
        bazaarReady.value = true;
      }
    }
    if (store.user) await store.refreshBilling();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
async function purchase(plan) {
  if (!store.user) return router.push("/account?redirect=/pricing");
  busy.value = plan.id;
  error.value = "";
  try {
    if (native) {
      const intent = await api("/billing/bazaar/intent", {
        method: "POST",
        body: { planId: plan.id },
      });
      const receipt = await BazaarBilling.purchase(intent);
      await api("/billing/bazaar/verify", { method: "POST", body: receipt });
      await store.refreshBilling();
      subscription.value = await api("/billing/bazaar/status");
      store.notice = "اشتراک بازار تأیید و فعال شد.";
      return;
    }
    const storageKey = `exam-checkout:${store.user.id}:${plan.id}`;
    const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
    const order = await api("/billing/checkout", {
      method: "POST",
      body: { planId: plan.id, idempotencyKey: key },
    });
    sessionStorage.removeItem(storageKey);
    await router.push("/checkout/" + order.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = "";
  }
}
async function restore() {
  busy.value = "restore";
  error.value = "";
  try {
    const { purchases } = await BazaarBilling.restore();
    for (const receipt of purchases)
      await api("/billing/bazaar/verify", { method: "POST", body: receipt });
    const result = await api("/billing/bazaar/reconcile", { method: "POST" });
    subscription.value = result.subscription;
    await store.refreshBilling();
    store.notice = "وضعیت خریدهای بازار به‌روز شد.";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = "";
  }
}
async function cancelRenewal() {
  if (
    !window.confirm(
      "تمدید خودکار لغو شود؟ دسترسی تا پایان دوره پرداخت‌شده باقی می‌ماند.",
    )
  )
    return;
  busy.value = "cancel";
  error.value = "";
  try {
    subscription.value = (
      await api("/billing/bazaar/cancel", { method: "POST" })
    ).subscription;
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = "";
  }
}
</script>
<template>
  <section class="pricing-page">
    <span class="eyebrow">طرحی برای هر کلاس</span>
    <h1>
      روی آموزش سرمایه‌گذاری کنید.<br /><span class="pricing-title-accent"
        >برگه‌ها را به ما بسپارید.</span
      >
    </h1>
    <p class="muted">
      ابزارهای طراحی، بردار و فونت در همه طرح‌ها؛ تولید سؤال با هوش مصنوعی فقط
      در طرح حرفه‌ای هوشمند.
    </p>
    <v-alert v-if="error" type="error" class="tw-my-4">{{ error }}</v-alert>
    <div v-if="native && store.user" class="support-actions">
      <v-btn
        variant="outlined"
        :disabled="!!busy"
        :loading="busy === 'restore'"
        @click="restore"
        >بازیابی خریدهای بازار</v-btn
      ><v-btn
        v-if="subscription?.autoRenewing"
        variant="outlined"
        :disabled="!!busy"
        @click="cancelRenewal"
        >لغو تمدید خودکار</v-btn
      >
    </div>
    <p v-if="subscription">
      {{
        subscription.autoRenewing
          ? "تمدید خودکار فعال است."
          : "تمدید خودکار لغو شده است."
      }}
      دسترسی تا
      {{ new Date(subscription.expiresAt).toLocaleDateString("fa-IR") }}.
    </p>
    <section
      v-if="store.billing"
      class="subscription-overview"
      aria-label="وضعیت اشتراک"
    >
      <div class="subscription-heading">
        <div>
          <span class="subscription-kicker">اشتراک شما</span>
          <h2>طرح فعلی: {{ store.billing.plan.name }}</h2>
        </div>
        <span class="subscription-badge"
          ><span></span
          >{{ store.billing.expiresAt ? "اشتراک فعال" : "طرح رایگان" }}</span
        >
      </div>
      <div class="subscription-metrics">
        <UsageDonut
          :value="store.billing.remaining ?? 0"
          :limit="store.billing.plan.exams ?? 0"
          :unlimited="store.billing.remaining === null"
          unit="آزمون"
          label="آزمون‌های باقی‌مانده"
          :detail="
            store.billing.remaining === null
              ? 'ساخت آزمون بدون محدودیت'
              : `از ${store.billing.plan.exams.toLocaleString('fa-IR')} آزمون ${store.billing.expiresAt ? 'در این دوره' : 'رایگان'}`
          "
        />
        <UsageDonut
          v-if="store.billing.ai?.limit"
          :value="store.billing.ai.remaining"
          :limit="store.billing.ai.limit"
          unit="دسته"
          label="سهمیه هوش مصنوعی"
          :detail="`از ${store.billing.ai.limit.toLocaleString('fa-IR')} دسته در این دوره`"
          tone="violet"
        />
        <UsageDonut
          v-if="store.billing.expiresAt"
          :value="daysLeft"
          :limit="subscriptionDays"
          unit="روز"
          label="تا پایان اشتراک"
          :detail="`تا ${new Date(store.billing.expiresAt).toLocaleDateString('fa-IR')}`"
          tone="teal"
        />
      </div>
      <div v-if="store.billing.expiresAt" class="subscription-note">
        <Icon name="saved" :size="18" />
        <p>
          وضعیت تمدید و تاریخ پایان را بررسی کنید. تغییر طرح پس از پایان اشتراک
          انجام می‌شود.
        </p>
      </div>
    </section>
    <div v-if="loading" class="loading-state" role="status">
      <v-progress-circular indeterminate color="primary" />
      <p>در حال دریافت طرح‌ها…</p>
    </div>
    <div v-else class="pricing-grid">
      <article
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ featured: plan.id === 'professional-ai' }"
      >
        <span v-if="plan.id === 'professional-ai'" class="plan-recommendation"
          >کامل‌ترین ابزار مدرس</span
        >
        <span class="eyebrow">{{
          plan.id === "professional-ai"
            ? "همراه هوشمند مدرس"
            : plan.id === "standard"
              ? "برای تدریس روزمره"
              : plan.id === "professional"
                ? "برای مدرس پرکار"
                : "برای شروع"
        }}</span>
        <h2>{{ plan.name }}</h2>
        <div class="plan-price">
          {{
            native && plan.price
              ? providerProducts[skuMap[plan.id]]?.price || "قیمت در دسترس نیست"
              : (plan.price / 10).toLocaleString("fa-IR")
          }}
          <small>{{
            native && plan.price
              ? " / ماه"
              : `تومان${plan.price ? " / ماه" : ""}`
          }}</small>
        </div>
        <ul>
          <li>
            <Icon name="check" :size="17" />
            {{
              plan.exams === null
                ? "ساخت آزمون نامحدود"
                : `${plan.exams.toLocaleString("fa-IR")} آزمون ${plan.id === "free" ? "در تمام عمر حساب" : "در هر ماه اشتراک"}`
            }}
          </li>
          <li>
            <Icon name="check" :size="17" /> حداکثر
            {{ plan.pages.toLocaleString("fa-IR") }} صفحه در هر خروجی
          </li>
          <li v-if="plan.aiGenerations">
            {{ plan.aiGenerations.toLocaleString("fa-IR") }} دسته سؤال با هوش
            مصنوعی در ماه (هر دسته تا ۱۰ سؤال)
          </li>
          <li v-else>
            <Icon name="blank" :size="17" />بدون تولید سؤال با هوش مصنوعی
          </li>
          <li><Icon name="check" :size="17" />طراحی شکل و نمودار فیزیک</li>
          <li>
            <Icon name="check" :size="17" />فونت‌های آماده و بارگذاری فونت شخصی
          </li>
          <li><Icon name="check" :size="17" />PDF دانش‌آموز و پاسخ‌نامه</li>
        </ul>
        <v-btn
          v-if="plan.price"
          color="primary"
          block
          :loading="busy === plan.id"
          :disabled="
            !!busy ||
            (native
              ? !bazaarReady ||
                !providerProducts[skuMap[plan.id]] ||
                !!store.billing?.expiresAt
              : !capabilities.mock) ||
            (!!store.billing?.expiresAt && store.billing.plan.id !== plan.id)
          "
          @click="purchase(plan)"
          >{{
            native
              ? "اشتراک ماهانه بازار"
              : capabilities.mock
                ? "خرید آزمایشی"
                : "خرید وب در دسترس نیست"
          }}</v-btn
        >
        <v-btn
          v-else
          variant="outlined"
          block
          :to="store.user ? '/dashboard' : '/account'"
          >{{ store.user ? "رفتن به آزمون‌ها" : "شروع رایگان" }}</v-btn
        >
      </article>
    </div>
    <section class="pricing-faq">
      <h2>پیش از انتخاب طرح</h2>
      <details>
        <summary>طرح رایگان چه محدودیتی دارد؟</summary>
        <p>
          سه آزمون در تمام عمر حساب، با خروجی حداکثر دو صفحه. حذف آزمون سهمیه را
          بازنمی‌گرداند.
        </p>
      </details>
      <details>
        <summary>تمدید و تغییر طرح چگونه است؟</summary>
        <p>
          اشتراک بازار ماهانه و دارای تمدید خودکار است. از همین صفحه می‌توانید
          تمدید را لغو کنید؛ دسترسی تا پایان دوره پرداخت‌شده باقی می‌ماند. تغییر
          طرح پس از پایان اشتراک امکان‌پذیر است. خرید آزمایشی محیط توسعه به‌صورت
          دستی تمدید می‌شود.
        </p>
      </details>
      <details>
        <summary>خروجی و ابزارها در کدام طرح‌ها هستند؟</summary>
        <p>
          همه طرح‌ها ابزار طراحی، فرمول، قلم و PDF دانش‌آموز و پاسخ‌نامه دارند.
          تولید سؤال هوشمند مخصوص طرح حرفه‌ای هوشمند است.
        </p>
      </details>
    </section>
    <p class="field-hint tw-mt-5">
      {{
        native
          ? "پرداخت از طریق بازار است. اشتراک ماهانه به‌صورت خودکار تمدید می‌شود؛ می‌توانید تمدید را لغو کنید. قیمت نهایی همان قیمت نمایش‌داده‌شده در بازار است."
          : capabilities.mock
            ? "پرداخت در محیط توسعه آزمایشی است و پولی دریافت نمی‌شود."
            : "خرید وب فعلاً در دسترس نیست."
      }}
      تغییر طرح پس از پایان اشتراک ممکن است. حذف آزمون سهمیه ساخت را
      بازنمی‌گرداند.
    </p>
  </section>
</template>
<style src="../subscription.css"></style>
