<script setup>
import { onMounted, ref, computed, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useExams, api } from "./features/exams/store.js";
import WorkspaceShell from "./layouts/WorkspaceShell.vue";
const store = useExams(),
  route = useRoute(),
  router = useRouter(),
  profileDialog = ref(false),
  help = ref(false),
  profile = ref({}),
  error = ref("");
const clock = ref(Date.now());
const days = computed(
  () =>
    Math.max(
      0,
      Math.ceil(
        (new Date(store.billing?.periodEndsAt).getTime() - clock.value) /
          86400000,
      ),
    ) || 0,
);
const dayPercent = computed(() => {
  const b = store.billing;
  if (!b?.periodStartsAt || !b.periodEndsAt) return 0;
  return Math.max(
    0,
    Math.min(
      100,
      (100 * (new Date(b.periodEndsAt) - clock.value)) /
        (new Date(b.periodEndsAt) - new Date(b.periodStartsAt)),
    ),
  );
});
let clockTimer;
onMounted(() => {
  clockTimer = setInterval(() => (clock.value = Date.now()), 60000);
});
onBeforeUnmount(() => clearInterval(clockTimer));
onMounted(async () => {
  try {
    await store.init();
  } catch (e) {
    error.value = e.message;
    store.ready = true;
  }
});
async function logout() {
  if (route.path.startsWith("/exam/")) {
    const failure = await router.push("/dashboard");
    if (failure) return;
  }
  try {
    if (await store.logout()) await router.push("/");
  } catch (cause) {
    error.value = cause.message;
  }
}
function editProfile() {
  profile.value = {
    institution: "",
    instructor: "",
    faculty: "",
    department: "",
    year: "",
    ...store.user?.profile,
  };
  profileDialog.value = true;
}
async function saveProfile() {
  try {
    store.user.profile = await api("/auth/profile", {
      method: "PUT",
      body: profile.value,
    });
    profileDialog.value = false;
  } catch (e) {
    error.value = e.message;
  }
}
</script>
<template>
  <router-view v-if="route.path === '/design-preview'" />
  <v-app v-else-if="route.path.startsWith('/eadamine')" theme="admin"
    ><router-view
  /></v-app>
  <v-app v-else>
    <WorkspaceShell
      :user="store.user"
      :billing="store.billing"
      :days="days"
      :day-percent="dayPercent"
      @institution="editProfile"
      @help="help = true"
      @logout="logout"
    >
      <component
        :is="route.path === '/' ? 'div' : 'main'"
        id="main"
        class="production-main"
      >
        <v-alert
          v-if="store.offlineMode || store.needsAuth"
          type="info"
          class="connection-banner"
          density="compact"
        >
          {{
            store.needsAuth
              ? "نشست شما پایان یافته؛ پیش‌نویس‌ها روی دستگاه محفوظ‌اند."
              : "کتابخانه دستگاه · برای همگام‌سازی دوباره متصل شوید."
          }}
          <router-link
            v-if="store.needsAuth"
            :to="{
              path: '/account',
              query: { reauth: '1', redirect: route.fullPath },
            }"
            >ورود دوباره</router-link
          >
        </v-alert>
        <v-alert v-if="error" type="error" closable @click:close="error = ''">{{
          error
        }}</v-alert
        ><router-view v-if="store.ready || route.path === '/'" />
        <div v-else class="loading-state">
          <v-progress-circular indeterminate color="primary" />
          <p>در حال آماده‌سازی فضای کار…</p>
        </div>
      </component>
    </WorkspaceShell>
    <v-dialog v-model="profileDialog"
      ><v-card title="مشخصات مؤسسه"
        ><v-card-text
          ><p class="muted tw-mb-5">
            این اطلاعات در آزمون‌های جدید شما به‌صورت خودکار قرار می‌گیرد.
          </p>
          <v-text-field
            v-for="(label, key) in {
              institution: 'نام مؤسسه',
              instructor: 'نام مدرس',
              faculty: 'دانشکده',
              department: 'گروه آموزشی',
              year: 'سال تحصیلی',
            }"
            :key="key"
            v-model="profile[key]"
            :label="label" /></v-card-text
        ><v-card-actions
          ><v-btn color="primary" variant="flat" @click="saveProfile"
            >ذخیره مشخصات</v-btn
          ><v-btn @click="profileDialog = false">انصراف</v-btn></v-card-actions
        ></v-card
      ></v-dialog
    ><v-dialog v-model="help"
      ><v-card title="اولین آزمون، در سه قدم"
        ><v-card-text
          ><ol class="help-list">
            <li>
              <b>مشخصات آزمون</b>
              <p>
                نام درس و عنوان را بنویسید و قالب مدرسه یا دانشگاه را انتخاب
                کنید.
              </p>
            </li>
            <li>
              <b>افزودن سؤال‌ها</b>
              <p>
                نوع سؤال را انتخاب کنید، متن و نمره را بنویسید. تغییرات خودکار
                ذخیره می‌شود.
              </p>
            </li>
            <li>
              <b>بازبینی و دریافت PDF</b>
              <p>
                برگه را بررسی کنید و نسخه دانش‌آموز یا پاسخ‌نامه مدرس را جداگانه
                بگیرید.
              </p>
            </li>
          </ol>
          <p class="muted">
            برای ساخت آزمون وارد حساب شوید. سه آزمون اول رایگان‌اند و خروجی
            رایگان تا دو صفحه است. برای پشتیبانی با مدیر سامانه تماس بگیرید.
          </p></v-card-text
        ><v-card-actions
          ><v-btn color="primary" @click="help = false"
            >متوجه شدم</v-btn
          ></v-card-actions
        ></v-card
      ></v-dialog
    ><v-snackbar
      :model-value="!!store.notice"
      @update:model-value="
        (value) => {
          if (!value) store.notice = '';
        }
      "
      timeout="5000"
      >{{ store.notice }}</v-snackbar
    >
  </v-app>
</template>
