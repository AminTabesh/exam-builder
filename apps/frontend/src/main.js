import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { createVuetify } from "vuetify";
import {
  VApp,
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VCardActions,
  VCheckbox,
  VDialog,
  VList,
  VListItem,
  VMenu,
  VProgressCircular,
  VProgressLinear,
  VSelect,
  VSnackbar,
  VTextField,
  VTextarea,
  VStepper,
  VStepperHeader,
  VStepperItem,
} from "vuetify/components";
import { labeledField } from "./components/LabeledField.js";
const components = {
  VApp,
  VAlert,
  VBtn,
  VCard,
  VCardText,
  VCardActions,
  VCheckbox,
  VDialog,
  VList,
  VListItem,
  VMenu,
  VProgressCircular,
  VProgressLinear,
  VSelect: labeledField(VSelect),
  VSnackbar,
  VTextField: labeledField(VTextField),
  VTextarea: labeledField(VTextarea),
  VStepper,
  VStepperHeader,
  VStepperItem,
};
import * as directives from "vuetify/directives";
import { fa } from "vuetify/locale";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import "vuetify/styles";
import "katex/dist/katex.min.css";
import "./fonts.css";
import "./styles.css";
import "@exam/shared/print.css";
import App from "./App.vue";
import "./mobile.css";
import { native } from "./platform/api.js";
import { initializeNative } from "./platform/runtime.js";
import { registerSW } from "virtual:pwa-register";
if (!native && import.meta.env.PROD) registerSW({ immediate: true });
import { useExams } from "./features/exams/store.js";
const pinia = createPinia();
const Dashboard = () => import("./features/exams/components/Dashboard.vue");
const Builder = () => import("./features/exams/components/Builder.vue");
const Account = () => import("./features/auth/components/Account.vue");
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/eadamine/:section?",
      component: () => import("./features/admin/Admin.vue"),
      meta: { public: true },
    },
    {
      path: "/design-preview",
      component: () => import("./design/PrecisionPreview.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      component: native ? Account : () => import("./Landing.vue"),
      meta: { public: true },
    },
    {
      path: "/privacy",
      component: () => import("./pages/Privacy.vue"),
      meta: { public: true },
    },
    {
      path: "/terms",
      component: () => import("./pages/Terms.vue"),
      meta: { public: true },
    },
    {
      path: "/support",
      component: () => import("./pages/Support.vue"),
      meta: { public: true },
    },
    { path: "/dashboard", component: Dashboard },
    { path: "/exam/:id", component: Builder },
    { path: "/account", component: Account, meta: { public: true } },
    {
      path: "/pricing",
      component: () => import("./features/billing/components/Pricing.vue"),
      meta: { public: true },
    },
    {
      path: "/checkout/:id",
      component: () => import("./features/billing/components/Checkout.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  if (["/privacy", "/terms", "/support"].includes(to.path)) return true;
  if (to.path === "/design-preview" || to.path.startsWith("/eadamine"))
    return true;
  const store = useExams(pinia);
  try {
    await store.init();
  } catch {
    return to.meta.public
      ? true
      : { path: "/account", query: { unavailable: "1" } };
  }
  if (native && to.path === "/" && store.user) return "/dashboard";
  if (!to.meta.public && !store.user)
    return { path: "/account", query: { redirect: to.fullPath } };
  if (!to.meta.public && store.user && !store.user.name?.trim())
    return { path: "/account", query: { redirect: to.fullPath } };
});
window.addEventListener("session-expired", () => {
  const store = useExams(pinia);
  store.needsAuth = true;
  store.notice = "برای همگام‌سازی دوباره وارد شوید؛ پیش‌نویس‌ها محفوظ‌اند.";
});
let resuming = false;
async function resume() {
  const store = useExams(pinia);
  if (resuming || !store.user || !navigator.onLine) return;
  resuming = true;
  try {
    if (!router.currentRoute.value.path.startsWith("/exam/"))
      await store.syncPending();
    if (native)
      await (
        await import("./platform/api.js")
      ).api("/billing/bazaar/reconcile", { method: "POST" });
    await store.refresh();
  } catch {
    /* Keep the last library and local edits available. */
  } finally {
    resuming = false;
  }
}
window.addEventListener("online", resume);
window.addEventListener("app-foreground", resume);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resume();
});
const vuetify = createVuetify({
  components,
  directives,
  locale: { locale: "fa", fallback: "en", messages: { fa }, rtl: { fa: true } },
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  theme: {
    defaultTheme: "light",
    themes: {
      admin: {
        dark: false,
        colors: {
          primary: "#15803d",
          secondary: "#166534",
          background: "#f5f7fb",
          surface: "#ffffff",
          error: "#a43232",
        },
      },
      light: {
        colors: {
          primary: "#2457d6",
          secondary: "#5f747d",
          background: "#f5f6f8",
          surface: "#ffffff",
          error: "#a43232",
          success: "#32735c",
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: "lg", elevation: 0, height: 44 },
    VTextField: {
      variant: "outlined",
      density: "comfortable",
      color: "primary",
    },
    VSelect: { variant: "outlined", density: "comfortable", color: "primary" },
    VTextarea: { variant: "outlined", color: "primary" },
    VCard: { rounded: "lg", elevation: 0 },
    VDialog: { maxWidth: 540 },
    VCheckbox: { color: "primary", hideDetails: true },
  },
});
createApp(App).use(pinia).use(router).use(vuetify).mount("#app");

initializeNative(router, useExams(pinia)).catch(() => {
  useExams(pinia).notice =
    "بعضی قابلیت‌های دستگاه آماده نشدند؛ برنامه را دوباره باز کنید.";
});
