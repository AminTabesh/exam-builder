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
import "./styles.css";
import "../shared/print.css";
import App from "./App.vue";
const Dashboard = () => import("./components/Dashboard.vue");
const Builder = () => import("./components/Builder.vue");
const Account = () => import("./components/Account.vue");
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Dashboard },
    { path: "/exam/:id", component: Builder },
    { path: "/account", component: Account },
  ],
});
const vuetify = createVuetify({
  components,
  directives,
  locale: { locale: "fa", fallback: "en", messages: { fa }, rtl: { fa: true } },
  icons: { defaultSet: "mdi", aliases, sets: { mdi } },
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        colors: {
          primary: "#203c56",
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
createApp(App).use(createPinia()).use(router).use(vuetify).mount("#app");
