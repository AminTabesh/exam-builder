<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useExams } from "../store.js";
import { count, total, digits, printStyles } from "@exam/shared/exam.js";
import Icon from "../../../components/Icon.vue";
const store = useExams(),
  router = useRouter(),
  search = ref(""),
  filter = ref("all"),
  sorting = ref("updated"),
  onlyOffline = ref(false),
  deleting = ref(null),
  error = ref(""),
  busy = ref(false);
const filtered = computed(() =>
  [...store.items]
    .sort((a, b) =>
      sorting.value === "title"
        ? a.document.meta.title.localeCompare(b.document.meta.title, "fa")
        : new Date(b.updated_at) - new Date(a.updated_at),
    )
    .filter(
      (e) =>
        (!onlyOffline.value ||
          store.downloaded.some((row) => row.id === e.id)) &&
        (filter.value === "all" ||
          e.document.layout.template === filter.value) &&
        [
          e.document.meta.title,
          e.document.meta.course,
          e.document.meta.institution,
        ]
          .join(" ")
          .includes(search.value),
    ),
);
async function create(example = false) {
  busy.value = true;
  try {
    const item = await store.create(example);
    router.push("/exam/" + item.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function duplicate(item) {
  try {
    await store.duplicate(item);
    store.notice = "یک کپی از آزمون ساخته شد.";
  } catch (e) {
    error.value = e.message;
  }
}
async function remove() {
  try {
    await store.remove(deleting.value.id);
    deleting.value = null;
    store.notice = "آزمون حذف شد.";
  } catch (e) {
    error.value = e.message;
  }
}
const date = (value) =>
  new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" }).format(
    new Date(value),
  );
</script>
<template>
  <section class="teacher-dashboard">
    <header class="dashboard-heading">
      <div>
        <span class="dashboard-kicker"
          >{{ store.user?.name || "مدرس" }}، به فضای کارتان خوش آمدید</span
        >
        <h1>آزمون‌های من<span class="heading-dot">.</span></h1>
        <p>
          برای کلاس بعدی آماده‌اید؟ آزمون‌ها و ایده‌های شما روی یک میز کار مرتب.
        </p>
      </div>
      <v-btn
        color="primary"
        size="large"
        :loading="busy"
        :disabled="store.offlineMode || store.needsAuth"
        @click="create(false)"
        ><Icon name="plus" /> ساخت آزمون جدید</v-btn
      >
    </header>
    <p v-if="store.offlineMode" class="offline-library-note" role="status">
      فقط آزمون‌های دانلودشده نمایش داده می‌شوند. ساخت و حذف آزمون به اینترنت
      نیاز دارد.
    </p>
    <v-alert v-if="error" type="error" closable @click:close="error = ''">{{
      error
    }}</v-alert>
    <section v-if="store.items.length" class="resume-exam">
      <div>
        <span class="dashboard-kicker">ادامهٔ آخرین کار</span>
        <h2>{{ store.items[0].document.meta.title || "آزمون بدون عنوان" }}</h2>
        <p>
          {{ store.items[0].document.meta.course }} ·
          {{ digits(count(store.items[0].document)) }} سؤال ·
          {{ digits(total(store.items[0].document) / 100) }} نمره
        </p>
        <router-link :to="'/exam/' + store.items[0].id"
          >ادامه طراحی <Icon name="left" :size="18"
        /></router-link>
      </div>
      <Icon name="file" :size="74" />
      <div class="library-metrics">
        <strong>{{ digits(store.items.length) }}</strong
        ><span>آزمون در کتابخانه</span
        ><strong>{{
          digits(
            store.items.reduce((sum, item) => sum + count(item.document), 0),
          )
        }}</strong
        ><span>سؤال طراحی‌شده</span>
      </div>
    </section>
    <section v-else class="first-exam">
      <span class="dashboard-kicker">اولین آزمون، شروع یک نظم تازه</span>
      <h2>از یک نمونه حرفه‌ای شروع کنید.</h2>
      <p>
        همه قالب‌های قبلی، فرمول‌ها و ابزارهای طراحی در استودیوی جدید در
        دسترس‌اند.
      </p>
      <v-btn
        color="primary"
        variant="outlined"
        :loading="busy"
        @click="create(true)"
        >شروع با آزمون نمونه <Icon name="left" :size="18"
      /></v-btn>
    </section>
    <section class="exam-library-table">
      <header>
        <h2>
          کتابخانه آزمون‌ها <small>{{ digits(store.items.length) }}</small>
        </h2>
        <label class="library-search"
          ><Icon name="search" :size="20" /><input
            v-model="search"
            aria-label="جست‌وجوی آزمون"
            placeholder="جست‌وجوی نام آزمون یا درس"
        /></label>
      </header>
      <nav class="library-filters" aria-label="فیلتر آزمون‌ها">
        <button
          v-for="f in [
            { id: 'all', label: 'همه آزمون‌ها' },
            { id: 'school', label: 'مدرسه' },
            { id: 'university', label: 'دانشگاه' },
          ]"
          :key="f.id"
          :aria-pressed="filter === f.id"
          @click="filter = f.id"
        >
          {{ f.label }}
        </button>
      </nav>
      <div class="library-tools">
        <label
          >مرتب‌سازی
          <select v-model="sorting" aria-label="مرتب‌سازی آزمون‌ها">
            <option value="updated">آخرین ویرایش</option>
            <option value="title">عنوان آزمون</option>
          </select></label
        ><label
          ><input type="checkbox" v-model="onlyOffline" /> آماده آفلاین</label
        >
      </div>
      <div class="exam-table-head">
        <span>عنوان و درس</span><span>سؤال و بارم</span><span>آخرین ویرایش</span
        ><span>عملیات</span>
      </div>
      <article v-for="item in filtered" :key="item.id" class="exam-table-row">
        <router-link :to="'/exam/' + item.id" class="exam-row-name"
          ><span class="exam-document-icon"
            ><Icon name="file" :size="25"
          /></span>
          <div>
            <h3>{{ item.document.meta.title || "آزمون بدون عنوان" }}</h3>
            <small
              v-if="store.downloaded.some((row) => row.id === item.id)"
              class="offline-badge"
              >{{
                store.downloaded.find((row) => row.id === item.id)
                  ?.offlineComplete
                  ? "آماده آفلاین"
                  : "دانلود ناقص"
              }}</small
            >
            <p>
              {{ item.document.meta.course || "بدون نام درس" }} ·
              {{
                printStyles.find(
                  (s) => s.id === (item.document.layout.style || "formal"),
                )?.label
              }}
            </p>
          </div></router-link
        ><span class="exam-row-count"
          >{{ digits(count(item.document)) }} سؤال<small
            >{{ digits(total(item.document) / 100) }} نمره</small
          ></span
        ><span class="exam-row-date">{{ date(item.updated_at) }}</span
        ><v-menu
          ><template #activator="{ props }"
            ><v-btn
              v-bind="props"
              variant="text"
              icon
              :aria-label="'گزینه‌های ' + item.document.meta.title"
              ><Icon name="more" /></v-btn></template
          ><v-list
            ><v-list-item @click="router.push('/exam/' + item.id)"
              ><Icon name="written" /> ویرایش آزمون</v-list-item
            ><v-list-item
              :disabled="store.offlineMode || store.needsAuth"
              @click="duplicate(item)"
              ><Icon name="copy" /> ساخت کپی</v-list-item
            ><v-list-item
              @click="
                store.downloadExam(item).catch((e) => (error = e.message))
              "
              ><Icon name="download" /> دانلود برای کار آفلاین</v-list-item
            >
            <v-list-item
              v-if="store.downloaded.some((row) => row.id === item.id)"
              @click="store.forgetExam(item).catch((e) => (error = e.message))"
              >حذف دانلود از دستگاه</v-list-item
            >
            <v-list-item
              :disabled="store.offlineMode || store.needsAuth"
              @click="deleting = item"
              ><Icon name="trash" /> حذف آزمون</v-list-item
            ></v-list
          ></v-menu
        >
      </article>
      <div v-if="!filtered.length" class="library-empty">
        <Icon name="file" :size="36" />
        <h3>
          {{
            search || filter !== "all"
              ? "آزمونی پیدا نشد"
              : "کتابخانه شما آماده است"
          }}
        </h3>
        <p>
          {{
            search || filter !== "all"
              ? "عبارت جست‌وجو یا فیلتر را تغییر دهید."
              : "اولین آزمون را بسازید یا با نمونه شروع کنید."
          }}
        </p>
      </div>
    </section>
  </section>
  <v-dialog :model-value="!!deleting" @update:model-value="deleting = null"
    ><v-card title="این آزمون حذف شود؟"
      ><v-card-text
        >«{{ deleting?.document.meta.title || "آزمون بدون عنوان" }}» حذف خواهد
        شد. این کار قابل بازگشت نیست.</v-card-text
      ><v-card-actions
        ><v-btn color="error" variant="flat" @click="remove">حذف آزمون</v-btn
        ><v-btn @click="deleting = null">نگه‌داشتن آزمون</v-btn></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>
<style scoped src="../dashboard.css"></style>
