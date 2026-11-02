<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, useExams } from "../stores/exams";
import Icon from "./Icon.vue";
const route = useRoute(),
  router = useRouter(),
  store = useExams(),
  mode = ref(route.query.mode || "login"),
  name = ref(""),
  email = ref(""),
  password = ref(""),
  error = ref(""),
  message = ref(""),
  busy = ref(false),
  attempted = ref(false);
async function submit() {
  attempted.value = true;
  error.value = "";
  message.value = "";
  if (
    ["login", "register", "recover"].includes(mode.value) &&
    !/^\S+@\S+\.\S+$/.test(email.value)
  )
    return;
  if (mode.value === "register" && !name.value.trim()) return;
  if (
    ["login", "register", "reset"].includes(mode.value) &&
    (password.value.length < (mode.value === "login" ? 1 : 10) ||
      password.value.length > 72)
  )
    return;
  busy.value = true;
  try {
    if (["verify", "reset"].includes(mode.value)) {
      const result = await api("/auth/token", {
        method: "POST",
        body: {
          token: route.query.token,
          kind: mode.value,
          password: password.value,
        },
      });
      message.value = result.message;
      mode.value = "login";
      router.replace("/account");
    } else if (mode.value === "login") {
      store.user = await api("/auth/login", {
        method: "POST",
        body: { email: email.value, password: password.value },
      });
      await store.refresh();
      router.push("/");
    } else {
      const result = await api(
        "/auth/" + (mode.value === "register" ? "register" : "recover"),
        {
          method: "POST",
          body: {
            email: email.value,
            password: password.value,
            name: name.value,
          },
        },
      );
      message.value = result.message;
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
function change(next) {
  mode.value = next;
  error.value = "";
  message.value = "";
  attempted.value = false;
}
</script>
<template>
  <section class="account-layout">
    <div class="account-intro">
      <span class="eyebrow">یک حساب، همه آزمون‌های شما</span>
      <h1>جای امن برگه‌هایی<br />که با دقت ساخته‌اید.</h1>
      <p>
        آزمون‌هایتان را نگه دارید، دوباره استفاده کنید و هر بار از همان جایی
        ادامه دهید که مانده بودید.
      </p>
      <div><Icon name="saved" /> ذخیره خصوصی آزمون‌ها</div>
      <div><Icon name="copy" /> استفاده دوباره از برگه‌های قبلی</div>
      <div><Icon name="school" /> سربرگ ثابت برای مؤسسه شما</div>
      <router-link to="/"
        >فعلاً با نسخه آزمایشی ادامه می‌دهم <Icon name="left" :size="18"
      /></router-link>
    </div>
    <v-card class="account-card"
      ><v-card-text
        ><div v-if="['login', 'register'].includes(mode)" class="account-tabs">
          <button
            :class="{ selected: mode === 'login' }"
            @click="change('login')"
          >
            ورود به حساب</button
          ><button
            :class="{ selected: mode === 'register' }"
            @click="change('register')"
          >
            ساخت حساب
          </button>
        </div>
        <h2>
          {{
            {
              login: "خوش آمدید",
              register: "شروع یک فضای کار تازه",
              recover: "بازیابی رمز عبور",
              verify: "تأیید نشانی ایمیل",
              reset: "انتخاب رمز جدید",
            }[mode]
          }}
        </h2>
        <p class="muted tw-mb-6">
          {{
            mode === "verify"
              ? "برای تأیید ایمیل، دکمه زیر را بزنید."
              : mode === "recover"
                ? "پیوند تغییر رمز را به ایمیل شما می‌فرستیم."
                : "اطلاعات خود را وارد کنید تا ادامه دهیم."
          }}
        </p>
        <v-alert v-if="error" type="error" class="tw-mb-5">{{ error }}</v-alert
        ><v-alert v-if="message" type="success" class="tw-mb-5">{{
          message
        }}</v-alert>
        <form @submit.prevent="submit">
          <v-text-field
            v-if="mode === 'register'"
            v-model="name"
            label="نام و نام خانوادگی"
            autocomplete="name"
            :error-messages="
              attempted && !name.trim() ? 'نام خود را بنویسید.' : ''
            "
          /><v-text-field
            v-if="['login', 'register', 'recover'].includes(mode)"
            v-model="email"
            label="نشانی ایمیل"
            type="email"
            autocomplete="email"
            dir="ltr"
            :error-messages="
              attempted && !/^\S+@\S+\.\S+$/.test(email)
                ? 'ایمیل معتبر وارد کنید.'
                : ''
            "
          /><v-text-field
            v-if="['login', 'register', 'reset'].includes(mode)"
            v-model="password"
            label="رمز عبور"
            type="password"
            :autocomplete="
              mode === 'login' ? 'current-password' : 'new-password'
            "
            :hint="mode === 'login' ? '' : 'بین ۱۰ تا ۷۲ نویسه'"
            persistent-hint
            :error-messages="
              attempted &&
              (password.length < (mode === 'login' ? 1 : 10) ||
                password.length > 72)
                ? 'طول رمز عبور را بررسی کنید.'
                : ''
            "
          /><v-btn
            type="submit"
            color="primary"
            block
            size="large"
            class="tw-mt-5"
            :loading="busy"
            >{{
              {
                login: "ورود به فضای کار",
                register: "ساخت حساب و ارسال ایمیل تأیید",
                recover: "ارسال پیوند بازیابی",
                verify: "تأیید ایمیل",
                reset: "ذخیره رمز جدید",
              }[mode]
            }}</v-btn
          >
        </form>
        <v-btn
          v-if="mode === 'login'"
          variant="text"
          block
          class="tw-mt-3"
          @click="change('recover')"
          >رمز عبور را فراموش کرده‌ام</v-btn
        ><v-btn
          v-if="!['login', 'register'].includes(mode)"
          variant="text"
          block
          class="tw-mt-3"
          @click="change('login')"
          >بازگشت به ورود</v-btn
        >
        <p class="field-hint tw-mt-5">
          آزمون‌های حالت مهمان روی همین دستگاه می‌مانند و با ورود به حساب منتقل
          نمی‌شوند.
        </p></v-card-text
      ></v-card
    >
  </section>
</template>
