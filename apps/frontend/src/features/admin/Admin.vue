<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { api, native, setSession } from "../../platform/api.js";
import { VPagination, VTable, VChip } from "vuetify/components";
import AdminDateTimeField from "./AdminDateTimeField.vue";
import Icon from "../../components/Icon.vue";
const route = useRoute(),
  user = ref(null),
  error = ref(""),
  busy = ref(false),
  identifier = ref(""),
  code = ref(""),
  challenge = ref(null),
  available = ref(false),
  data = ref({}),
  selected = ref(null),
  selectedOrder = ref(null),
  q = ref(""),
  filters = ref({}),
  page = ref(1),
  reason = ref(""),
  action = ref("grant"),
  planId = ref("standard"),
  endsAt = ref(""),
  confirm = ref("");
const sections = [
  ["", "نمای کلی", "dashboard"],
  ["users", "کاربران", "account"],
  ["subscriptions", "اشتراک‌ها", "pricing"],
  ["orders", "خریدها", "pricing"],
  ["usage", "مصرف هوش مصنوعی", "book"],
  ["audit", "رویدادهای مدیریت", "book"],
  ["deletions", "حذف حساب‌ها", "account"],
];
const section = computed(() => route.params.section || "");
async function run(fn) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function load() {
  selected.value = null;
  selectedOrder.value = null;
  const kind = ["users", "subscriptions"].includes(section.value)
    ? "users"
    : section.value || "overview";
  data.value = await api(
    "/admin/" +
      kind +
      "?" +
      new URLSearchParams({ q: q.value, page: page.value, ...filters.value }),
  );
}
async function init() {
  available.value = (await api("/admin/bootstrap")).available;
  try {
    user.value = await api("/auth/me");
  } catch (e) {
    if (e.status !== 401) throw e;
  }
  if (user.value?.role === "admin") await load();
}
async function request() {
  challenge.value = await api(
    native ? "/mobile/auth/challenge" : "/auth/otp/request",
    {
      method: "POST",
      body: {
        identifier: identifier.value,
        admin: true,
        privacyConsent: "2026-11-15",
      },
    },
  );
}
async function verify() {
  const result = await api(
    native ? "/mobile/auth/verify" : "/auth/otp/verify",
    {
      method: "POST",
      body: {
        challengeId: challenge.value.challengeId,
        challengeSecret: challenge.value.challengeSecret,
        code: code.value.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
      },
    },
  );
  if (native) await setSession(result.token);
  user.value = native ? result.user : result;
  if (available.value && user.value.role !== "admin")
    user.value = await api("/admin/bootstrap", { method: "POST" });
  if (user.value.role === "admin") await load();
}
async function detail(id) {
  selected.value = await api("/admin/users/" + id);
  reason.value = "";
  confirm.value = "";
}
async function mutate(suffix, method, body) {
  await api("/admin/users/" + selected.value.id + suffix, {
    method,
    body: { ...body, reason: reason.value },
  });
  await detail(selected.value.id);
}
async function remove() {
  await api("/admin/users/" + selected.value.id, {
    method: "DELETE",
    body: { reason: reason.value, confirm: confirm.value },
  });
  await load();
}
async function logout() {
  await api(native ? "/mobile/auth/logout" : "/auth/logout", {
    method: "POST",
  });
  if (native) await setSession(null);
  user.value = null;
  challenge.value = null;
}
onMounted(() => run(init));
watch(section, () => {
  page.value = 1;
  q.value = "";
  filters.value = {};
  if (user.value?.role === "admin") run(load);
});
const labels = {
  user: "کاربر",
  id: "شناسه",
  owner_id: "شناسه کاربر",
  name: "نام",
  email: "ایمیل",
  phone: "تلفن",
  role: "نقش",
  status: "وضعیت",
  effective_plan: "طرح فعال",
  institution: "نام مؤسسه",
  instructor: "نام مدرس",
  faculty: "دانشکده",
  department: "گروه آموزشی",
  year: "سال تحصیلی",
  created_at: "تاریخ",
  plan_id: "طرح",
  price: "مبلغ (ریال)",
  provider: "ارائه‌دهنده",
  actor: "مدیر",
  target: "کاربر",
  action: "عملیات",
  reason: "دلیل",
  period_id: "دوره",
};
const cols = computed(() =>
  ["users", "subscriptions"].includes(section.value)
    ? ["user", "email", "role", "status", "effective_plan"]
    : section.value === "orders"
      ? ["id", "owner_id", "plan_id", "price", "provider", "status"]
      : section.value === "audit"
        ? ["created_at", "actor", "target", "action", "reason"]
        : section.value === "deletions"
          ? ["id", "status", "created_at"]
          : ["owner_id", "status", "created_at"],
);
</script>
<template>
  <div class="admin-shell" dir="rtl">
    <aside>
      <router-link class="admin-brand" to="/eadamine"
        ><Icon name="book" /> آزمون‌برگ <small>مدیریت</small></router-link
      >
      <nav>
        <router-link
          v-for="[key, label, icon] in sections"
          :key="key"
          :to="'/eadamine' + (key ? '/' + key : '')"
          :class="{ active: section === key }"
          ><Icon :name="icon" />{{ label }}</router-link
        >
      </nav>
      <router-link to="/dashboard">بازگشت به فضای مدرس</router-link>
    </aside>
    <div class="admin-content">
      <header>
        <span
          >فضای مدیریت / {{ sections.find((s) => s[0] === section)?.[1] }}</span
        ><v-btn v-if="user" variant="text" @click="run(logout)">خروج</v-btn>
      </header>
      <main>
        <v-alert v-if="error" type="error" class="mb-4" role="alert">{{
          error
        }}</v-alert
        ><v-progress-linear v-if="busy" indeterminate color="primary" />
        <section v-if="!user || user.role !== 'admin'" class="admin-login">
          <span class="admin-eyebrow">فضای مدیریت آزمون‌برگ</span>
          <h1>ورود مدیر</h1>
          <p v-if="available">
            اولین ورود موفق از این صفحه، دسترسی مدیر را دریافت می‌کند.
          </p>
          <p v-else-if="user">این حساب دسترسی مدیریت ندارد.</p>
          <form @submit.prevent="run(challenge ? verify : request)">
            <v-text-field
              v-model="identifier"
              label="ایمیل یا شماره همراه"
              :disabled="!!challenge"
              required
            /><v-text-field
              v-if="challenge"
              v-model="code"
              label="کد شش‌رقمی"
              inputmode="numeric"
              required
              maxlength="6"
            />
            <p class="admin-consent">
              با درخواست کد،
              <router-link to="/privacy">حریم خصوصی</router-link> و
              <router-link to="/terms">شرایط استفاده</router-link> را می‌پذیرم.
            </p>
            <v-btn type="submit" color="primary" :disabled="busy">{{
              challenge ? "تأیید و ورود" : "دریافت کد ورود"
            }}</v-btn
            ><v-btn v-if="challenge" variant="text" @click="challenge = null"
              >تغییر شناسه</v-btn
            >
          </form>
        </section>
        <template v-else
          ><div class="admin-title">
            <div>
              <span class="admin-eyebrow">کنترل و نظارت</span>
              <h1>{{ sections.find((s) => s[0] === section)?.[1] }}</h1>
            </div>
            <v-btn variant="outlined" @click="run(load)" :disabled="busy"
              >تازه‌سازی</v-btn
            >
          </div>
          <template v-if="!section"
            ><div class="admin-stats">
              <article
                v-for="[k, label] in [
                  ['users', 'کاربران'],
                  ['active', 'حساب فعال'],
                  ['exams', 'آزمون‌ها'],
                  ['ai', 'تولید هوش مصنوعی'],
                  ['orders', 'سفارش‌ها'],
                ]"
                :key="k"
              >
                <span>{{ label }}</span
                ><strong>{{ data[k] ?? "—" }}</strong>
              </article>
            </div>
            <section class="admin-card">
              <h2>اشتراک فعال: {{ data.subscriptions?.[0]?.count || 0 }}</h2>
              <p v-for="row in data.ordersByStatus" :key="row._id">
                {{ row._id }}: {{ row.count }}
              </p>
              <h2>درآمد پرداخت‌های ثبت‌شده</h2>
              <strong>{{ data.revenue?.[0]?.total || 0 }} ریال</strong>
              <p>پرداخت‌های آزمایشی و دسترسی‌های هدیه در این مبلغ نیستند.</p>
              <h2>آخرین فعالیت مدیران</h2>
              <p v-for="item in data.recent" :key="item.id">
                {{ item.action }} · {{ item.created_at }} · {{ item.reason }}
              </p>
            </section></template
          >
          <template v-else
            ><form
              v-if="['users', 'subscriptions'].includes(section)"
              class="admin-search"
              @submit.prevent="
                page = 1;
                run(load);
              "
            >
              <v-text-field
                v-model="q"
                label="جست‌وجوی نام، ایمیل یا تلفن"
                hide-details
              /><v-btn type="submit" color="primary" :disabled="busy"
                >جست‌وجو</v-btn
              >
            </form>
            <form
              class="admin-filters"
              :class="{ 'admin-audit-filters': section === 'audit' }"
              @submit.prevent="
                page = 1;
                run(load);
              "
            >
              <template v-if="['users', 'subscriptions'].includes(section)">
                <v-select
                  v-model="filters.role"
                  label="فیلتر نقش"
                  :items="[
                    { title: 'همه', value: '' },
                    { title: 'مدیر', value: 'admin' },
                    { title: 'کاربر', value: 'user' },
                  ]"
                  hide-details
                />
                <v-select
                  v-model="filters.status"
                  label="فیلتر وضعیت"
                  :items="[
                    { title: 'همه', value: '' },
                    { title: 'فعال', value: 'active' },
                    { title: 'تعلیق', value: 'suspended' },
                  ]"
                  hide-details
                />
                <v-select
                  v-model="filters.plan"
                  label="فیلتر طرح"
                  :items="[
                    '',
                    'free',
                    'standard',
                    'professional',
                    'professional-ai',
                  ]"
                  hide-details
                />
              </template>
              <template v-else-if="section === 'audit'">
                <v-text-field
                  v-for="[key, label] in [
                    ['actor', 'شناسه مدیر'],
                    ['target', 'شناسه کاربر'],
                    ['action', 'نوع عملیات'],
                  ]"
                  :key="key"
                  v-model="filters[key]"
                  :label="label"
                  hide-details
                />
                <AdminDateTimeField
                  v-model="filters.from"
                  label="از تاریخ"
                  hide-details
                /><AdminDateTimeField
                  v-model="filters.to"
                  label="تا تاریخ"
                  hide-details
                />
              </template>
              <template v-else-if="['orders', 'usage'].includes(section)"
                ><v-text-field
                  v-model="filters.owner_id"
                  label="شناسه کاربر"
                  hide-details /><v-text-field
                  v-model="filters.status"
                  label="وضعیت"
                  hide-details
              /></template>
              <v-btn
                v-if="section !== 'deletions'"
                type="submit"
                variant="outlined"
                :disabled="busy"
                >اعمال فیلتر</v-btn
              >
            </form>
            <section
              class="admin-card admin-table"
              :class="{
                'admin-user-table': ['users', 'subscriptions'].includes(
                  section,
                ),
              }"
            >
              <v-table density="comfortable" hover>
                <thead>
                  <tr>
                    <th v-for="c in cols" :key="c">{{ labels[c] || c }}</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.items" :key="item.id">
                    <td v-for="c in cols" :key="c">
                      <div
                        v-if="
                          c === 'user' ||
                          ['owner_id', 'actor', 'target'].includes(c)
                        "
                        class="admin-person"
                      >
                        <strong>{{
                          (c === "user" ? item : item[c + "_user"])?.name ||
                          "بدون نام"
                        }}</strong>
                        <span class="admin-person-phone" dir="ltr">{{
                          (c === "user" ? item : item[c + "_user"])?.phone ||
                          "تلفن ثبت نشده"
                        }}</span>
                        <span class="admin-person-id" dir="ltr">{{
                          c === "user" ? item.id : item[c]
                        }}</span>
                      </div>
                      <v-chip
                        v-else-if="c === 'status' || c === 'role'"
                        size="small"
                        variant="tonal"
                        :color="
                          [
                            'active',
                            'admin',
                            'paid',
                            'succeeded',
                            'done',
                          ].includes(item[c])
                            ? 'primary'
                            : undefined
                        "
                        >{{ item[c] ?? "—" }}</v-chip
                      >
                      <span v-else>{{ item[c] ?? "—" }}</span>
                    </td>
                    <td>
                      <v-btn
                        v-if="section === 'orders'"
                        variant="text"
                        @click="
                          run(async () => {
                            selectedOrder = await api(
                              '/admin/orders/' + item.id,
                            );
                          })
                        "
                        >جزئیات خرید</v-btn
                      >
                      <v-btn
                        v-if="['users', 'subscriptions'].includes(section)"
                        variant="text"
                        @click="run(() => detail(item.id))"
                        >جزئیات</v-btn
                      ><v-btn
                        v-if="section === 'deletions' && item.status !== 'done'"
                        @click="
                          run(async () => {
                            await api(
                              '/admin/deletions/' + item.id + '/retry',
                              {
                                method: 'POST',
                                body: { reason: 'تلاش مجدد حذف' },
                              },
                            );
                            await load();
                          })
                        "
                        >تلاش مجدد</v-btn
                      >
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <p v-if="!data.items?.length">موردی پیدا نشد.</p>
            </section>
            <div class="admin-pagination">
              <span>{{ data.total || 0 }} مورد</span>
              <v-pagination
                :model-value="page"
                :length="Math.max(1, Math.ceil((data.total || 0) / 25))"
                :total-visible="5"
                :disabled="busy"
                color="primary"
                density="comfortable"
                rounded="lg"
                aria-label="صفحه‌بندی جدول"
                @update:model-value="
                  (value) => {
                    page = value;
                    run(load);
                  }
                "
              />
            </div>
            <section v-if="selectedOrder" class="admin-card">
              <div class="admin-title">
                <h2>جزئیات خرید</h2>
                <v-btn variant="text" @click="selectedOrder = null">بستن</v-btn>
              </div>
              <dl>
                <template v-for="(value, key) in selectedOrder.order" :key="key"
                  ><dt>{{ labels[key] || key }}</dt>
                  <dd>{{ value }}</dd></template
                >
              </dl>
              <h3>دوره‌های مرتبط</h3>
              <p v-for="period in selectedOrder.periods" :key="period.id">
                {{ period.plan_id }} · {{ period.starts_at }} تا
                {{ period.ends_at }}
              </p>
            </section>
            <section v-if="selected" class="admin-card">
              <div class="admin-title">
                <h2>{{ selected.name || selected.email || selected.phone }}</h2>
                <v-btn variant="text" @click="selected = null">بستن</v-btn>
              </div>
              <p>{{ selected.id }}</p>
              <p>{{ selected.email }} · {{ selected.phone }}</p>
              <div class="admin-fields">
                <v-text-field v-model="selected.name" label="نام" /><v-select
                  v-model="selected.role"
                  label="نقش"
                  :items="['user', 'admin']"
                /><v-select
                  v-model="selected.status"
                  label="وضعیت"
                  :items="['active', 'suspended']"
                /><v-text-field
                  v-for="key in [
                    'institution',
                    'instructor',
                    'faculty',
                    'department',
                    'year',
                  ]"
                  :key="key"
                  v-model="selected.profile[key]"
                  :label="labels[key] || key"
                />
              </div>
              <p>
                آزمون‌ها: {{ selected.exams }} · مصرف:
                {{ selected.billing.used }} · باقی‌مانده:
                {{ selected.billing.remaining ?? "نامحدود" }} · طرح:
                {{ selected.billing.plan.name }}
              </p>
              <v-textarea
                v-model="reason"
                label="دلیل تغییر (الزامی)"
                rows="2"
              />
              <div class="admin-actions">
                <v-btn
                  color="primary"
                  :disabled="busy || !reason.trim()"
                  @click="
                    run(() =>
                      mutate('', 'PUT', {
                        name: selected.name,
                        role: selected.role,
                        status: selected.status,
                        profile: selected.profile,
                      }),
                    )
                  "
                  >ذخیره مشخصات</v-btn
                ><v-btn
                  variant="outlined"
                  :disabled="busy || !reason.trim()"
                  @click="run(() => mutate('/revoke-sessions', 'POST', {}))"
                  >خروج از همه دستگاه‌ها</v-btn
                >
              </div>
              <h2>مدیریت دسترسی اشتراک</h2>
              <p>
                این تغییر فقط دسترسی برنامه را تغییر می‌دهد. لغو پرداخت دوره‌ای
                یا بازپرداخت بازار باید جداگانه انجام شود.
              </p>
              <div class="admin-fields">
                <v-select
                  v-model="action"
                  label="عملیات"
                  :items="[
                    { title: 'هدیه', value: 'grant' },
                    { title: 'تمدید هدیه فعال', value: 'extend' },
                    { title: 'جایگزینی', value: 'replace' },
                    { title: 'لغو دسترسی تا تاریخ', value: 'revoke' },
                  ]"
                /><v-select
                  v-model="planId"
                  label="طرح"
                  :items="['standard', 'professional', 'professional-ai']"
                /><AdminDateTimeField
                  v-model="endsAt"
                  label="پایان دسترسی / لغو"
                />
              </div>
              <v-btn
                color="primary"
                :disabled="busy || !reason.trim() || !endsAt"
                @click="
                  run(() =>
                    mutate('/subscription', 'POST', {
                      action,
                      planId,
                      endsAt,
                    }),
                  )
                "
                >اعمال دسترسی</v-btn
              >
              <h3>تاریخچه دسترسی مدیر</h3>
              <p v-for="o in selected.overrides" :key="o.id">
                {{ o.plan_id }} · {{ o.ends_at }}
              </p>
              <h3>خریدهای کاربر</h3>
              <p v-for="o in selected.orders" :key="o.id">
                {{ o.plan_id }} · {{ o.price }} ریال · {{ o.provider }} ·
                {{ o.status }}
              </p>
              <div class="admin-danger">
                <h2>حذف دائمی حساب</h2>
                <p>
                  آزمون‌ها و فایل‌ها پاک می‌شوند؛ سوابق مالی بدون اطلاعات هویتی
                  نگهداری می‌شوند. برای تأیید، شناسه کاربر را وارد کنید.
                </p>
                <v-text-field
                  v-model="confirm"
                  label="شناسه کاربر برای تأیید حذف"
                /><v-btn
                  color="error"
                  :disabled="busy || !reason.trim() || confirm !== selected.id"
                  @click="run(remove)"
                  >حذف دائمی</v-btn
                >
              </div>
            </section></template
          ></template
        >
      </main>
    </div>
  </div>
</template>
<style>
.admin-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  background: #f5f7fb;
  color: #172b49;
  font-family: Dana, Vazirmatn, Arial, sans-serif;
}
.admin-shell aside {
  background: #123c2b;
  color: #c8dfd1;
  padding: 32px 18px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.admin-brand {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 22px;
  color: white;
  font-weight: 800;
  flex-wrap: wrap;
}
.admin-brand small {
  font-size: 12px;
}
.admin-shell nav {
  display: grid;
  gap: 6px;
}
.admin-shell nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  min-height: 48px;
}
.admin-shell nav a.active {
  background: #ffffff18;
  color: white;
  box-shadow: inset -3px 0 #86d6a4;
}
.admin-content {
  min-width: 0;
}
.admin-content header {
  height: 88px;
  background: white;
  border-bottom: 1px solid #dce3ed;
  padding: 0 36px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.admin-content main {
  max-width: 1500px;
  margin: auto;
  padding: 32px;
}
.admin-title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}
.admin-title h1 {
  font-size: 30px;
  margin-top: 8px;
}
.admin-eyebrow {
  color: #16803f;
  font-size: 12px;
  font-weight: 700;
}
.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.admin-stats article,
.admin-card,
.admin-login {
  background: white;
  border: 1px solid #dce3ed;
  border-radius: 12px;
  padding: 24px;
}
.admin-stats strong {
  display: block;
  font-size: 32px;
  margin-top: 12px;
  color: #166534;
}
.admin-card {
  margin-bottom: 20px;
}
.admin-card h2 {
  font-size: 20px;
  margin: 20px 0 12px;
}
.admin-card p {
  line-height: 2;
  margin-block: 12px;
  color: #526780;
}
.admin-card dd {
  overflow-wrap: anywhere;
  margin-bottom: 12px;
  color: #526780;
}
.admin-table {
  overflow: auto;
}
.admin-table table {
  border-collapse: collapse;
  width: 100%;
  text-align: start;
  white-space: nowrap;
  font-size: 13px;
}
.admin-table th,
.admin-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #e5eaf0;
  text-align: start;
}
.admin-table th {
  color: #526780;
}
.admin-search,
.admin-pagination,
.admin-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.admin-pagination {
  justify-content: center;
}
.admin-search > .labeled-field {
  flex: 1;
  min-width: 0;
}
.admin-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr)) auto;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  border: 1px solid #dce3ed;
  border-radius: 12px;
  background: white;
  align-items: end;
}
.admin-filters > .labeled-field,
.admin-filters > .admin-datetime-field {
  min-width: 0;
}
.admin-filters .control-label {
  display: block;
  margin-bottom: 8px;
  white-space: normal;
  line-height: 1.6;
}
.admin-filters > .v-btn {
  min-height: 48px;
  margin-bottom: 0;
}
.admin-audit-filters {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.admin-audit-filters > .labeled-field:nth-child(n + 4) {
  min-width: 0;
}
.admin-person {
  display: grid;
  gap: 4px;
  min-width: 200px;
  padding-block: 4px;
}
.admin-person strong {
  font-size: 13px;
  color: #172b49;
}
.admin-person-phone {
  text-align: start;
  unicode-bidi: plaintext;
  color: #526780;
  font-size: 12px;
}
.admin-person-id {
  text-align: start;
  unicode-bidi: plaintext;
  font-size: 11px;
  color: #718096;
  overflow-wrap: anywhere;
  white-space: normal;
}
.admin-pagination {
  flex-wrap: wrap;
}
@media (max-width: 1100px) {
  .admin-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.admin-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.admin-login {
  max-width: 480px;
  margin: 40px auto;
}
.admin-login h1 {
  margin: 12px 0 24px;
}
.admin-consent {
  font-size: 12px;
  line-height: 2;
  margin-bottom: 16px;
}
.admin-danger {
  border-top: 1px solid #ebc8c8;
  margin-top: 32px;
  padding-top: 12px;
}
.admin-shell :focus-visible {
  outline: 3px solid #16a34a;
  outline-offset: 3px;
}
@media (max-width: 767px) {
  .admin-shell {
    display: block;
  }
  .admin-shell aside {
    padding: 14px 12px;
    gap: 12px;
  }
  .admin-shell nav {
    display: flex;
    overflow: auto;
    gap: 4px;
  }
  .admin-shell nav a {
    white-space: nowrap;
    padding: 10px;
    font-size: 12px;
  }
  .admin-shell aside > a:last-child {
    font-size: 12px;
  }
  .admin-content header {
    height: 64px;
    padding: 0 12px;
  }
  .admin-content main {
    padding: 16px 12px;
  }
  .admin-card,
  .admin-login {
    padding: 16px;
  }
  .admin-title h1 {
    font-size: 25px;
  }
  .admin-fields {
    grid-template-columns: 1fr;
  }
  .admin-actions {
    flex-wrap: wrap;
  }
  .admin-filters {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
    gap: 14px;
  }
  .admin-audit-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-person {
    min-width: 160px;
  }
  .admin-user-table table {
    white-space: normal;
    table-layout: fixed;
  }
  .admin-user-table th:nth-child(n + 2):nth-child(-n + 5),
  .admin-user-table td:nth-child(n + 2):nth-child(-n + 5) {
    display: none;
  }
  .admin-user-table td {
    overflow-wrap: anywhere;
    padding: 12px 4px;
  }
  .admin-shell input,
  .admin-shell textarea {
    font-size: 16px;
  }
}
</style>
