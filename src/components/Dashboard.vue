<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useExams } from "../stores/exams.js";
import { count, total, digits } from "../../shared/exam.js";
import Icon from "./Icon.vue";
const store = useExams(),
  router = useRouter(),
  search = ref(""),
  filter = ref("all"),
  deleting = ref(null),
  error = ref(""),
  busy = ref(false);
const filtered = computed(() =>
  store.items.filter(
    (e) =>
      (filter.value === "all" || e.document.layout.template === filter.value) &&
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
  <div class="dashboard">
    <div class="page-heading">
      <div>
        <div class="eyebrow">یک شروع مرتب، برای یک آزمون خوب</div>
        <h1>آزمون‌های من<span class="heading-dot">.</span></h1>
        <p>آزمون بعدی‌تان را بسازید؛ ساده، دقیق و آماده چاپ.</p>
      </div>
      <v-btn color="primary" size="large" :loading="busy" @click="create(false)"
        ><Icon name="plus" class="tw-me-2" />ساخت آزمون جدید</v-btn
      >
    </div>
    <v-alert
      v-if="error"
      type="error"
      closable
      class="tw-mb-5"
      @click:close="error = ''"
      >{{ error }}</v-alert
    >
    <section class="welcome-banner">
      <div class="welcome-copy">
        <span class="small-tag">همراه شما، از اولین سؤال</span>
        <h2>شما به سؤال‌ها فکر کنید،<br />ما به برگه‌ای که چاپ می‌شود.</h2>
        <p>
          یک آزمون منظم با سربرگ، بارم‌بندی و فضای پاسخ.<br />بدون درگیری با
          تنظیمات پیچیده صفحه.
        </p>
        <v-btn
          variant="outlined"
          color="primary"
          @click="create(true)"
          :disabled="busy"
          >شروع با آزمون نمونه
          <Icon name="left" :size="18" class="tw-ms-3" /></v-btn
        ><span class="sample-note">قابل ویرایش و مناسب برای آشنایی</span>
      </div>
      <div class="paper-illustration" aria-hidden="true">
        <div class="floating-badge">
          <Icon name="check" :size="17" />آماده برای چاپ
        </div>
        <div class="illustration-back"></div>
        <div class="illustration-page">
          <div class="mini-opening">به نام خدا</div>
          <div class="mini-title">آزمون میان‌ترم ریاضی</div>
          <div class="mini-meta">
            <span>نام و نام خانوادگی: ……………</span
            ><span>مدت آزمون: ۶۰ دقیقه</span>
          </div>
          <div class="mini-table">
            <div><b>ردیف</b><b>شرح سؤال</b><b>نمره</b></div>
            <div>
              <span>۱</span
              ><i
                ><em></em><em></em
                ><small>○ الف &nbsp; ○ ب &nbsp; ○ ج &nbsp; ○ د</small></i
              ><span>۲</span>
            </div>
            <div>
              <span>۲</span
              ><i
                ><em></em><em></em>
                <hr />
                <hr />
                <hr /></i
              ><span>۳</span>
            </div>
            <div>
              <span>۳</span
              ><i
                ><em></em>
                <hr />
                <hr /></i
              ><span>۵</span>
            </div>
          </div>
          <div class="mini-footer">موفق باشید &nbsp; · &nbsp; صفحه ۱ از ۲</div>
        </div>
        <div class="a4-tag">A4 <span>اندازه استاندارد، خیال آسوده</span></div>
      </div>
    </section>
    <section class="stats-grid" aria-label="آمار آزمون‌ها">
      <div>
        <span class="stat-icon"><Icon name="file" /></span>
        <div>
          <strong>{{ digits(store.items.length) }}</strong
          ><span>آزمون ساخته‌شده</span>
        </div>
      </div>
      <div>
        <span class="stat-icon"><Icon name="mcq" /></span>
        <div>
          <strong>{{
            digits(store.items.reduce((s, e) => s + count(e.document), 0))
          }}</strong
          ><span>سؤال طراحی‌شده</span>
        </div>
      </div>
      <div>
        <span class="stat-icon"><Icon name="saved" /></span>
        <div>
          <strong class="stat-word">{{
            store.user ? "حساب شخصی" : "ذخیره در مرورگر"
          }}</strong
          ><span>{{
            store.user
              ? "آزمون‌های شما، فقط برای شما"
              : "بدون نیاز به ثبت‌نام، شروع کنید"
          }}</span>
        </div>
      </div>
    </section>
    <section class="exam-library">
      <div class="library-header">
        <div>
          <h2>
            کتابخانه آزمون‌ها <span>{{ digits(store.items.length) }}</span>
          </h2>
          <p>همه برگه‌های شما، در یک جای مرتب.</p>
        </div>
        <div class="search-box">
          <Icon name="search" :size="21" /><input
            v-model="search"
            aria-label="جست‌وجوی آزمون"
            placeholder="جست‌وجو در آزمون‌ها…"
          />
        </div>
      </div>
      <div class="filter-row" role="group" aria-label="فیلتر آزمون‌ها">
        <button
          v-for="f in [
            { id: 'all', label: 'همه آزمون‌ها' },
            { id: 'school', label: 'مدرسه' },
            { id: 'university', label: 'دانشگاه' },
          ]"
          :key="f.id"
          :class="{ selected: filter === f.id }"
          @click="filter = f.id"
        >
          {{ f.label }}</button
        ><span>آخرین ویرایش</span>
      </div>
      <div v-if="filtered.length" class="exam-grid">
        <article v-for="item in filtered" :key="item.id" class="exam-card">
          <div class="exam-card-top">
            <span class="document-icon"><Icon name="file" :size="28" /></span
            ><v-menu
              ><template #activator="{ props }"
                ><v-btn
                  v-bind="props"
                  variant="text"
                  size="small"
                  :aria-label="'گزینه‌های ' + item.document.meta.title"
                  icon
                  ><Icon name="more" /></v-btn></template
              ><v-list
                ><v-list-item @click="duplicate(item)"
                  ><template #prepend
                    ><Icon name="copy" class="tw-me-3" /></template
                  >ساخت کپی</v-list-item
                ><v-list-item @click="deleting = item"
                  ><template #prepend
                    ><Icon name="trash" class="tw-me-3" /></template
                  >حذف آزمون</v-list-item
                ></v-list
              ></v-menu
            >
          </div>
          <router-link :to="'/exam/' + item.id" class="exam-card-link"
            ><span class="template-label"
              >{{
                item.document.layout.template === "school" ? "مدرسه" : "دانشگاه"
              }}
              <span>·</span>
              {{
                item.document.layout.language === "fa" ? "فارسی" : "انگلیسی"
              }}</span
            >
            <h3>{{ item.document.meta.title || "آزمون بدون عنوان" }}</h3>
            <p>{{ item.document.meta.course || "نام درس هنوز وارد نشده" }}</p>
            <div class="exam-details">
              <span>{{ digits(count(item.document)) }} سؤال</span
              ><span>{{ digits(total(item.document) / 100) }} نمره</span
              ><span>{{ digits(item.document.meta.duration) }} دقیقه</span>
            </div>
            <div class="exam-card-bottom">
              <span>ویرایش {{ date(item.updated_at) }}</span
              ><span>ادامه ویرایش <Icon name="left" :size="16" /></span></div
          ></router-link>
        </article>
        <button class="new-exam-card" @click="create(false)">
          <span><Icon name="plus" :size="26" /></span><b>یک آزمون تازه</b
          ><small>از یک برگه سفید شروع کنید</small>
        </button>
      </div>
      <div v-else class="empty-state">
        <span class="empty-icon"><Icon name="file" :size="34" /></span>
        <h3>
          {{
            search || filter !== "all"
              ? "آزمونی پیدا نشد"
              : "جای اولین آزمون شما اینجاست"
          }}
        </h3>
        <p>
          {{
            search || filter !== "all"
              ? "عبارت جست‌وجو یا فیلتر را تغییر دهید."
              : "از یک برگه تازه شروع کنید یا نمونه را ببینید و به سلیقه خود تغییر دهید."
          }}
        </p>
        <v-btn
          variant="text"
          color="primary"
          @click="
            search || filter !== 'all'
              ? ((search = ''), (filter = 'all'))
              : create(false)
          "
          >{{
            search || filter !== "all"
              ? "نمایش همه آزمون‌ها"
              : "ساخت اولین آزمون"
          }}<Icon name="left" :size="18" class="tw-ms-2"
        /></v-btn>
      </div>
    </section>
    <div class="privacy-note">
      <Icon name="saved" :size="17" /><span>{{
        store.user
          ? "آزمون‌های شما خصوصی هستند و فقط در حساب شما نمایش داده می‌شوند."
          : "حالت آزمایشی: آزمون‌ها در همین مرورگر ذخیره می‌شوند. با پاک‌کردن داده‌های مرورگر حذف خواهند شد."
      }}</span>
    </div>
  </div>
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
