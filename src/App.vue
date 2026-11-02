<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useExams, api } from "./stores/exams";
import Icon from "./components/Icon.vue";
const store = useExams(),
  route = useRoute(),
  router = useRouter(),
  profileDialog = ref(false),
  help = ref(false),
  profile = ref({}),
  error = ref("");
onMounted(async () => {
  try {
    await store.init();
  } catch (e) {
    error.value = e.message;
    store.ready = true;
  }
});
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
  <v-app
    ><a class="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <div
      class="app-shell"
      :class="{ 'editor-shell': route.path.startsWith('/exam/') }"
    >
      <aside class="sidebar">
        <router-link to="/" class="brand"
          ><span class="brand-mark"><Icon name="book" :size="28" /></span
          ><span
            >آزمون‌برگ<small>فرصت بیشتر برای آموزش</small></span
          ></router-link
        >
        <div class="workspace-label">فضای کار مدرس</div>
        <nav aria-label="منوی اصلی">
          <router-link
            to="/"
            class="nav-item"
            :class="{ active: route.path === '/' }"
            ><Icon name="dashboard" />آزمون‌های من<span class="nav-count">{{
              store.items.length.toLocaleString("fa-IR")
            }}</span></router-link
          ><button
            class="nav-item"
            @click="store.user ? editProfile() : router.push('/account')"
          >
            <Icon name="school" />مشخصات مؤسسه
          </button>
        </nav>
        <div class="sidebar-tip">
          <span class="tip-line"></span><Icon name="file" :size="29" />
          <h3>از ایده تا برگه آزمون</h3>
          <p>سؤال‌ها را بنویسید؛ چیدمان و آماده‌سازی برگه با ما.</p>
          <button @click="help = true">
            راهنمای کوتاه <Icon name="left" :size="16" />
          </button>
        </div>
        <div class="sidebar-bottom">
          <button class="nav-item" @click="help = true">
            <Icon name="help" />راهنما و پشتیبانی
          </button>
          <div class="profile">
            <span class="avatar"><Icon name="account" /></span>
            <div>
              <b>{{ store.user?.name || "مدرس مهمان" }}</b
              ><small>{{
                store.user ? "حساب شخصی" : "فضای آزمایشی · روی این دستگاه"
              }}</small>
            </div>
            <button
              v-if="store.user"
              class="icon-button"
              aria-label="خروج از حساب"
              @click="store.logout().then(() => router.push('/'))"
            >
              <Icon name="logout" :size="19" /></button
            ><router-link v-else to="/account" class="login-link"
              >ورود</router-link
            >
          </div>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumb">
            فضای کار <span>/</span>
            <b>{{
              route.path.startsWith("/exam/")
                ? "ساخت آزمون"
                : route.path === "/account"
                  ? "حساب کاربری"
                  : "آزمون‌های من"
            }}</b>
          </div>
          <div class="topbar-note">
            <span class="status-dot"></span> با خیال راحت، آماده چاپ
          </div>
        </header>
        <main id="main">
          <v-alert
            v-if="error"
            type="error"
            closable
            @click:close="error = ''"
            >{{ error }}</v-alert
          ><v-alert
            v-if="store.user && !store.user.verified"
            type="warning"
            class="tw-mb-4"
            >برای ذخیره و دریافت PDF، ایمیل خود را تأیید کنید.
            <v-btn
              variant="text"
              @click="
                api('/auth/resend', { method: 'POST' })
                  .then((r) => (store.notice = r.message))
                  .catch((e) => (error = e.message))
              "
              >ارسال دوباره پیوند</v-btn
            ></v-alert
          ><router-view v-if="store.ready" :key="route.fullPath" />
          <div v-else class="loading-state">
            <v-progress-circular indeterminate color="primary" />
            <p>در حال آماده‌سازی فضای کار…</p>
          </div>
        </main>
        <footer class="app-footer">
          آزمون‌برگ <span>با دقت طراحی کنید، با اطمینان چاپ کنید.</span
          ><span>ساخته‌شده برای آموزش</span>
        </footer>
      </div>
    </div>
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
            در حالت مهمان، آزمون‌ها فقط در همین مرورگر نگهداری می‌شوند. برای
            نگهداری در حساب خود، ثبت‌نام کنید. برای پشتیبانی با مدیر سامانه خود
            تماس بگیرید.
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
    ></v-app
  >
</template>
