<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import AccountPopover from "../components/AccountPopover.vue";
import Icon from "../components/Icon.vue";
const props = defineProps({
  user: Object,
  billing: Object,
  days: Number,
  dayPercent: Number,
});
const emit = defineEmits(["institution", "help", "logout"]);
const route = useRoute();
const collapsed = ref(false);
const publicPage = computed(() => !props.user || route.path === "/");
const studio = computed(() => route.path.startsWith("/exam/"));
</script>
<template>
  <div
    class="workspace-shell"
    :class="{
      'public-layout': publicPage,
      'studio-shell': studio,
      'menu-collapsed': collapsed && !publicPage,
    }"
  >
    <a class="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <aside
      v-if="!publicPage"
      id="workspace-navigation"
      class="workspace-navigation"
    >
      <router-link
        to="/dashboard"
        class="workspace-brand"
        aria-label="آزمون‌برگ"
        ><Icon name="book" :size="28" /><span>آزمون‌برگ</span></router-link
      ><span class="navigation-label">فضای کار مدرس</span>
      <nav aria-label="منوی اصلی">
        <router-link
          to="/dashboard"
          aria-label="آزمون‌های من"
          :class="{ active: route.path === '/dashboard' }"
          ><Icon name="dashboard" /><span>آزمون‌های من</span></router-link
        ><button aria-label="مشخصات مؤسسه" @click="emit('institution')">
          <Icon name="school" /><span>مشخصات مؤسسه</span></button
        ><router-link
          to="/account"
          aria-label="حساب کاربری"
          :class="{ active: route.path === '/account' }"
          ><Icon name="account" /><span>حساب کاربری</span></router-link
        ><router-link
          to="/pricing"
          aria-label="اشتراک و پرداخت"
          :class="{ active: route.path === '/pricing' }"
          ><Icon name="pricing" /><span>اشتراک و پرداخت</span></router-link
        >
      </nav>
      <button
        class="workspace-help"
        aria-label="راهنما و پشتیبانی"
        @click="emit('help')"
      >
        <Icon name="help" /><span>راهنما و پشتیبانی</span>
      </button>
    </aside>
    <div class="workspace-content">
      <header v-if="route.path !== '/'" class="workspace-header">
        <button
          v-if="!publicPage"
          class="desktop-menu-toggle"
          :aria-expanded="!collapsed"
          aria-controls="workspace-navigation"
          :aria-label="collapsed ? 'باز کردن منوی اصلی' : 'بستن منوی اصلی'"
          @click="collapsed = !collapsed"
        >
          <Icon name="menu" :size="22" />
        </button>
        <span v-if="!publicPage" class="workspace-location"
          >فضای کار /
          {{
            studio
              ? "استودیو آزمون"
              : route.path === "/pricing"
                ? "طرح‌ها و قیمت‌ها"
                : route.path === "/account"
                  ? "حساب کاربری"
                  : "آزمون‌های من"
          }}</span
        ><router-link v-else to="/" class="public-brand"
          ><Icon name="book" />آزمون‌برگ</router-link
        ><AccountPopover
          v-if="user"
          :name="user.name || ''"
          :plan="billing?.plan.name || 'حساب شخصی'"
          :remaining="billing?.remaining ?? null"
          :limit="billing?.plan.exams ?? null"
          :days="billing?.periodEndsAt ? days : null"
          :day-percent="dayPercent"
          :loading="!billing"
          can-logout
          @logout="emit('logout')"
        />
        <nav v-else class="public-links">
          <router-link to="/pricing">طرح‌ها</router-link
          ><router-link to="/account">ورود / شروع رایگان</router-link>
        </nav>
      </header>
      <slot />
      <footer class="workspace-legal">
        <router-link to="/privacy">حریم خصوصی</router-link
        ><router-link to="/terms">شرایط استفاده</router-link
        ><router-link to="/support">راهنما و پشتیبانی</router-link>
      </footer>
    </div>
    <nav
      v-if="!publicPage"
      class="mobile-bottom-nav"
      aria-label="ناوبری تلفن همراه"
    >
      <router-link
        to="/dashboard"
        :class="{ active: route.path === '/dashboard' || studio }"
        ><Icon name="dashboard" /><span>آزمون‌ها</span></router-link
      >
      <router-link to="/pricing" :class="{ active: route.path === '/pricing' }"
        ><Icon name="pricing" /><span>اشتراک</span></router-link
      >
      <router-link to="/account" :class="{ active: route.path === '/account' }"
        ><Icon name="account" /><span>حساب من</span></router-link
      >
    </nav>
  </div>
</template>
<style scoped>
.workspace-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  background: #f5f7fb;
  color: #172b49;
  font-family: Dana, Vazirmatn, Arial, sans-serif;
  transition: grid-template-columns 280ms ease;
}
.workspace-navigation {
  position: sticky;
  top: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #102a56;
  color: #becde5;
  padding: 32px 18px;
  gap: 30px;
  min-width: 0;
  overflow: hidden;
  transition: padding 280ms ease;
}
.workspace-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  font-size: 24px;
  font-weight: 800;
}
.navigation-label {
  font-size: 11px;
  color: #91a7ca;
  margin: 10px 14px -12px;
}
.workspace-navigation nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.workspace-navigation nav > a,
.workspace-navigation button {
  display: flex;
  align-items: center;
  gap: 12px;
  background: transparent;
  color: inherit;
  padding: 14px;
  border: 0;
  border-radius: 8px;
  text-align: right;
  font: inherit;
  font-size: 13px;
  min-height: 48px;
}
.workspace-navigation .active {
  background: #ffffff15;
  color: white;
  box-shadow: inset -3px 0 #83a8ff;
}
.workspace-navigation nav > a:hover,
.workspace-navigation button:hover {
  background: #ffffff10;
}
.workspace-help {
  margin-top: auto;
}
.workspace-content {
  min-width: 0;
}
.workspace-header {
  height: 88px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 36px;
  background: white;
  border-bottom: 1px solid #dce3ed;
}
.workspace-location {
  font-size: 12px;
  color: #62738b;
}
.public-layout {
  grid-template-columns: minmax(0, 1fr);
}
.public-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 800;
}
.public-links {
  display: flex;
  gap: 24px;
  margin-inline-start: auto;
  font-size: 13px;
}
.workspace-shell.menu-collapsed {
  grid-template-columns: 76px minmax(0, 1fr);
}
.menu-collapsed .workspace-navigation {
  padding: 28px 12px;
}
.menu-collapsed .workspace-navigation nav > a,
.menu-collapsed .workspace-navigation button,
.menu-collapsed .workspace-brand {
  padding-inline: 8px;
}
@media (min-width: 768px) {
  .workspace-navigation svg {
    flex-shrink: 0;
  }
  .workspace-brand,
  .workspace-navigation nav > a,
  .workspace-navigation button {
    transition:
      padding 280ms ease,
      gap 280ms ease,
      background-color 180ms ease;
  }
  .workspace-navigation span {
    display: block;
    min-width: 0;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    opacity: 1;
    transition:
      max-width 280ms ease,
      opacity 180ms ease,
      margin 280ms ease;
  }
  .menu-collapsed .workspace-navigation span {
    max-width: 0;
    opacity: 0;
    margin-inline: 0;
  }
  .menu-collapsed .workspace-brand,
  .menu-collapsed .workspace-navigation nav > a,
  .menu-collapsed .workspace-navigation button {
    gap: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-shell,
  .workspace-navigation,
  .workspace-navigation span,
  .workspace-brand,
  .workspace-navigation nav > a,
  .workspace-navigation button {
    transition: none;
  }
}
.workspace-shell :focus-visible:not(input, textarea) {
  outline: 3px solid #83a8ff;
  outline-offset: 3px;
}
@media (max-width: 767px) {
  .workspace-shell,
  .workspace-shell.menu-collapsed {
    display: block;
  }
  .workspace-navigation {
    position: static;
    height: auto;
    padding: 10px;
    gap: 0;
  }
  .workspace-navigation .workspace-brand,
  .workspace-navigation .navigation-label,
  .workspace-help {
    display: none !important;
  }
  .workspace-navigation nav {
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
  }
  .workspace-navigation nav > a,
  .workspace-navigation nav > button {
    padding: 10px;
    white-space: nowrap;
    gap: 6px;
    font-size: 11px;
  }
  .menu-collapsed .workspace-navigation nav span {
    display: inline;
  }
  .menu-collapsed .workspace-navigation {
    padding: 10px;
  }
  .workspace-header {
    height: 75px;
    padding: 0 18px;
  }
  .workspace-location {
    display: none;
  }
  .workspace-navigation svg {
    width: 18px;
    flex-shrink: 0;
  }
  .public-brand {
    font-size: 19px;
  }
}
.desktop-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid #dce3ed;
  border-radius: 8px;
  background: white;
  color: #35527b;
  flex-shrink: 0;
}
.desktop-menu-toggle:hover {
  background: #edf3ff;
}
@media (max-width: 767px) {
  .desktop-menu-toggle {
    display: none;
  }
}
</style>
