<script setup>
import { ref, computed, onBeforeUnmount, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, useExams } from "../../exams/store.js";
import { native, setSession } from "../../../platform/api.js";
import {
  clearAccount,
  contextOwner,
  pendingDrafts,
  rememberAccount,
  storageUsage,
} from "../../exams/offline.js";
import OtpInput from "../../../components/OtpInput.vue";
import { englishDigits, persianDigits as fa } from "../../../lib/numbers.js";
const route = useRoute(),
  router = useRouter(),
  store = useExams();
const storageInfo = ref({});
onMounted(async () => {
  storageInfo.value = await storageUsage().catch(() => ({}));
});
async function retainOffline() {
  const retained = await navigator.storage?.persist?.();
  message.value = retained
    ? "نگه‌داری پایدار داده‌های آفلاین فعال شد."
    : "دستگاه نگه‌داری پایدار را تضمین نمی‌کند؛ تغییرات را مرتب همگام کنید.";
}
const method = ref("phone");
const consent = ref(false),
  methods = ref({ phone: true, email: true });
const accountUser = computed(() => (store.needsAuth ? null : store.user));
onMounted(async () => {
  try {
    methods.value = await api("/auth/methods");
    if (!methods.value.phone) method.value = "email";
  } catch {
    /* Server errors remain recoverable. */
  }
});
const identifier = ref(""),
  name = ref(store.user?.name || ""),
  code = ref(""),
  challenge = ref(null),
  error = ref(""),
  busy = ref(false),
  countdown = ref(0),
  message = ref("");
const needsName = computed(
  () => !!accountUser.value && !accountUser.value.name?.trim(),
);
function continueToApp() {
  const target =
    typeof route.query.redirect === "string" &&
    route.query.redirect.startsWith("/") &&
    !route.query.redirect.startsWith("//")
      ? route.query.redirect
      : "/dashboard";
  return router.replace(target);
}
watch(identifier, (value) => {
  if (method.value === "phone") identifier.value = englishDigits(value);
});
const timer = setInterval(
  () => (countdown.value = Math.max(0, countdown.value - 1)),
  1000,
);
onBeforeUnmount(() => clearInterval(timer));
async function saveName() {
  if (busy.value) return;
  if (!name.value.trim()) {
    error.value = "نام و نام خانوادگی خود را وارد کنید.";
    return;
  }
  const completingSignup = needsName.value;
  busy.value = true;
  error.value = "";
  try {
    const result = await api("/auth/name", {
      method: "PUT",
      body: { name: name.value },
    });
    store.user.name = result.name;
    await rememberAccount(store.user, store.billing, store.fonts).catch(() => {
      store.notice = "نام روی سرور ذخیره شد؛ ذخیره آفلاین انجام نشد.";
    });
    message.value = "نام شما ذخیره شد.";
    if (completingSignup) await continueToApp();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function request() {
  if (busy.value) return;
  if (!consent.value) {
    error.value = "ابتدا حریم خصوصی و شرایط استفاده را بخوانید و بپذیرید.";
    return;
  }
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    challenge.value = await api(
      accountUser.value
        ? "/auth/identities/request"
        : native
          ? "/mobile/auth/challenge"
          : "/auth/otp/request",
      {
        method: "POST",
        body: {
          privacyConsent: "2026-11-15",
          identifier:
            method.value === "phone"
              ? englishDigits(identifier.value)
              : identifier.value,
        },
      },
    );
    countdown.value = challenge.value.retryAfter;
    code.value = "";
    message.value = "کد تأیید ارسال شد. کد تا ۵ دقیقه معتبر است.";
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function verify() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const linking = !!accountUser.value;
  try {
    const result = await api(
      linking
        ? "/auth/identities/verify"
        : native
          ? "/mobile/auth/verify"
          : "/auth/otp/verify",
      {
        method: "POST",
        body: {
          challengeId: challenge.value.challengeId,
          challengeSecret: challenge.value.challengeSecret,
          code: englishDigits(code.value),
        },
      },
    );
    const user = native && !linking ? result.user : result;
    const previous = contextOwner();
    if (previous && previous !== user.id) {
      if (
        (await pendingDrafts(previous)).length &&
        !window.confirm(
          "تغییر حساب، پیش‌نویس‌های همگام‌نشده حساب قبلی را از دستگاه پاک می‌کند. ادامه می‌دهید؟",
        )
      ) {
        if (!native) await api("/auth/logout", { method: "POST" });
        else await setSession(null);
        store.needsAuth = true;
        throw new Error(
          "تغییر حساب انجام نشد؛ با حساب قبلی وارد شوید تا پیش‌نویس‌ها همگام شوند.",
        );
      }
      await clearAccount(previous);
    }
    if (native && !linking) await setSession(result.token);
    store.user = user;
    store.needsAuth = false;
    await store.refresh();
    if (linking) {
      challenge.value = null;
      identifier.value = "";
      message.value = "روش ورود به حساب متصل شد.";
    } else {
      challenge.value = null;
      message.value = "";
      name.value = store.user.name || "";
      if (!needsName.value) await continueToApp();
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="account-layout">
    <div class="account-intro">
      <span class="eyebrow">یک حساب، همه آزمون‌های شما</span>
      <h1>
        {{
          accountUser ? "حساب شما، راه‌های ورود شما." : "فرصت بیشتر برای آموزش."
        }}
      </h1>
      <p>با شماره همراه یا ایمیل وارد شوید. یک کد کوتاه برای ورود کافی است.</p>
      <p v-if="accountUser" dir="auto">
        {{ accountUser.email || "ایمیل متصل نشده" }}<br />{{
          accountUser.phone || "شماره همراه متصل نشده"
        }}
      </p>
      <router-link to="/pricing">مشاهده طرح‌ها و قیمت‌ها ←</router-link>
    </div>
    <v-card class="account-card"
      ><v-card-text>
        <h2>
          {{
            needsName
              ? "نام شما چیست؟"
              : accountUser
                ? "اتصال شماره همراه یا ایمیل"
                : "ورود / ساخت حساب"
          }}
        </h2>
        <p class="muted">
          {{
            needsName
              ? "برای تکمیل حساب، نام و نام خانوادگی خود را وارد کنید."
              : accountUser
                ? "کد تأیید را برای روش ورود جدید دریافت کنید."
                : "با اولین تأیید، حساب شما ساخته می‌شود."
          }}
        </p>
        <v-alert v-if="error" type="error" class="tw-my-4">{{ error }}</v-alert>
        <p v-if="message" role="status" class="tw-my-4">{{ message }}</p>
        <form
          v-if="accountUser && !challenge"
          class="account-name"
          @submit.prevent="saveName"
        >
          <v-text-field
            v-model="name"
            :label="needsName ? 'نام و نام خانوادگی' : 'نام نمایشی مدرس'"
            autocomplete="name"
            :autofocus="needsName"
            maxlength="100"
            required
          /><v-btn
            type="submit"
            variant="tonal"
            color="primary"
            :loading="busy"
            >{{ needsName ? "ذخیره و ادامه" : "ذخیره نام" }}</v-btn
          >
          <hr v-if="!needsName" class="tw-my-5" />
        </form>
        <form
          v-if="!needsName"
          @submit.prevent="challenge ? verify() : request()"
        >
          <div v-if="!challenge" class="login-methods">
            <v-btn
              v-if="methods.phone"
              :variant="method === 'phone' ? 'tonal' : 'text'"
              @click="
                method = 'phone';
                identifier = '';
              "
              >شماره همراه</v-btn
            ><v-btn
              v-if="methods.email"
              :variant="method === 'email' ? 'tonal' : 'text'"
              @click="
                method = 'email';
                identifier = '';
              "
              >ایمیل</v-btn
            >
          </div>
          <v-checkbox
            v-if="!challenge"
            v-model="consent"
            label="حریم خصوصی و شرایط استفاده را می‌پذیرم"
          />
          <p v-if="!challenge" class="privacy-links">
            <router-link to="/privacy">حریم خصوصی</router-link> ·
            <router-link to="/terms">شرایط استفاده</router-link>
          </p>
          <v-text-field
            v-model="identifier"
            :label="method === 'phone' ? 'شماره همراه' : 'ایمیل'"
            :inputmode="method === 'phone' ? 'tel' : 'email'"
            autocomplete="username"
            dir="ltr"
            :disabled="!!challenge"
            required
          />
          <OtpInput v-if="challenge" v-model="code" :disabled="busy" />
          <v-btn
            type="submit"
            color="primary"
            block
            :disabled="!!challenge && !/^\d{6}$/.test(code)"
            :loading="busy"
            >{{ challenge ? "تأیید و ادامه" : "دریافت کد ورود" }}</v-btn
          >
        </form>
        <template v-if="challenge">
          <v-btn
            variant="text"
            :disabled="busy || countdown > 0"
            @click="request"
            >{{
              countdown
                ? `ارسال دوباره در ${fa(countdown)} ثانیه`
                : "ارسال دوباره کد"
            }}</v-btn
          >
          <v-btn
            variant="text"
            :disabled="busy"
            @click="
              challenge = null;
              error = '';
              message = '';
            "
            >تغییر شماره یا ایمیل</v-btn
          >
        </template>
        <section v-if="accountUser" class="offline-account-settings">
          <hr class="tw-my-5" />
          <h3>حافظه دستگاه</h3>
          <p class="field-hint">
            {{ fa(store.downloaded.length) }} آزمون دانلودشده. مصرف کل فضای این
            برنامه:
            {{ fa(((storageInfo.usage || 0) / 1048576).toFixed(1)) }} مگابایت.
            دانلودها را از منوی آزمون در کتابخانه مدیریت کنید.
          </p>
          <v-btn variant="outlined" @click="retainOffline"
            >درخواست نگه‌داری پایدار پیش‌نویس‌ها</v-btn
          >
        </section>
        <template v-if="accountUser && store.legacyCount">
          <hr class="tw-my-5" />
          <p>
            {{ fa(store.legacyCount) }} آزمون قدیمی روی این مرورگر دارید. انتقال
            آن‌ها از سهمیه ساخت آزمون استفاده می‌کند.
          </p>
          <v-btn
            :loading="busy"
            @click="
              busy = true;
              store.adoptGuestExams().finally(() => (busy = false));
            "
            >انتقال آزمون‌های این مرورگر</v-btn
          >
        </template>
      </v-card-text></v-card
    >
  </section>
</template>
