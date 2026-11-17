<script setup>
import { computed, ref } from "vue";
import AccountPopover from "../components/AccountPopover.vue";
import { persianDigits as fa, englishDigits } from "../lib/numbers.js";
import PaperPreview from "../features/exams/components/PaperPreview.vue";
import {
  exampleExam,
  newQuestion,
  paragraph,
  printStyles,
} from "@exam/shared/exam.js";
import Icon from "../components/Icon.vue";
const view = ref("landing"),
  selected = ref(0),
  mobileTab = ref("edit"),
  search = ref("");
const questions = ref([
  {
    title: "ریشه‌های معادله درجه دوم",
    type: "چندگزینه‌ای",
    score: 2,
    body: "ریشه‌های معادله زیر را به دست آورید و گزینه درست را انتخاب کنید.",
  },
  {
    title: "تابع و نمودار",
    type: "تشریحی",
    score: 4,
    body: "نمودار تابع را رسم کنید و دامنه آن را بنویسید.",
  },
  {
    title: "احتمال یک پیشامد",
    type: "تشریحی",
    score: 3,
    body: "احتمال رخ دادن پیشامد را محاسبه کنید.",
  },
]);
const sampleExam = exampleExam();
const paperStyle = ref(sampleExam.layout.style || "formal");
const paperTemplate = ref(sampleExam.layout.template || "school");
const paperKind = ref("student");
const previewExam = computed(() => ({
  ...sampleExam,
  layout: {
    ...sampleExam.layout,
    style: paperStyle.value,
    template: paperTemplate.value,
  },
  questions: questions.value.map((q, i) => ({
    ...newQuestion(q.type === "چندگزینه‌ای" ? "mcq" : "written"),
    id: `preview-question-${i}`,
    body: paragraph(q.body),
    marks: String(q.score || 0),
    options: ["۲ و ۳", "۱ و ۶", "۳ و ۴", "۱ و ۵"],
    answer: q.type === "چندگزینه‌ای" ? "۲ و ۳" : "راه‌حل نمونه",
    lines: 4,
  })),
}));
const question = computed(() => questions.value[selected.value]);
const exams = [
  {
    name: "آزمون میان‌ترم ریاضی",
    course: "ریاضی · پایه دهم",
    count: 12,
    date: "امروز، ۱۰:۳۰",
  },
  {
    name: "ارزشیابی فصل سوم",
    course: "فیزیک · پایه یازدهم",
    count: 8,
    date: "دیروز، ۱۴:۲۰",
  },
  {
    name: "تمرین هفتگی جبر",
    course: "ریاضی · پایه دهم",
    count: 6,
    date: "۲۱ آبان",
  },
];
const filtered = computed(() =>
  exams.filter(
    (e) => e.name.includes(search.value) || e.course.includes(search.value),
  ),
);
function openExam() {
  view.value = "studio";
  mobileTab.value = "edit";
}
function add() {
  questions.value.push({
    title: "سؤال جدید",
    type: "تشریحی",
    score: 1,
    body: "",
  });
  selected.value = questions.value.length - 1;
  mobileTab.value = "edit";
}
function move(offset) {
  const next = selected.value + offset;
  if (next < 0 || next >= questions.value.length) return;
  const q = questions.value.splice(selected.value, 1)[0];
  questions.value.splice(next, 0, q);
  selected.value = next;
}
</script>
<template>
  <div class="precision" dir="rtl">
    <div class="review-bar">
      <span>پیش‌نمایش طراحی · داده‌های نمونه، بدون ذخیره در حساب</span>
      <nav aria-label="صفحه‌های پیش‌نمایش">
        <button
          v-for="(label, key) in {
            landing: 'معرفی محصول',
            dashboard: 'فضای کار',
            studio: 'استودیو آزمون',
          }"
          :key="key"
          :aria-pressed="view === key"
          @click="view = key"
        >
          {{ label }}
        </button>
      </nav>
    </div>
    <template v-if="view === 'landing'">
      <header class="marketing-header">
        <a href="#" class="wordmark" @click.prevent="view = 'landing'"
          ><Icon name="book" /> آزمون‌برگ<span>ابزار کار مدرس</span></a
        >
        <nav>
          <a href="#workflow">روش کار</a><a href="#features">امکانات</a
          ><router-link to="/pricing">طرح‌ها</router-link>
        </nav>
        <button class="action" @click="view = 'dashboard'">
          ورود به فضای کار <Icon name="left" :size="17" />
        </button>
      </header>
      <main class="marketing">
        <section class="hero">
          <div class="hero-copy">
            <div class="kicker">
              <span></span> برای معلم‌هایی که به جزئیات اهمیت می‌دهند
            </div>
            <h1>از فکرِ سؤال،<br />تا یک برگهٔ <em>بی‌نقص.</em></h1>
            <p>
              یک میز کار برای طراحی سؤال، تنظیم برگه و آماده‌سازی آزمون. منظم،
              دقیق و همراه با شیوهٔ تدریس شما.
            </p>
            <div class="hero-actions">
              <button class="action" @click="openExam">
                استودیو را امتحان کنید <Icon name="left" :size="18" /></button
              ><a href="#workflow">ببینید چگونه کار می‌کند ↓</a>
            </div>
            <div class="hero-proof">
              <span>۰۱ / طراحی</span><span>۰۲ / بازبینی</span
              ><span>۰۳ / چاپ</span>
            </div>
          </div>
          <div class="hero-note">
            <span class="vertical-label">AZMOONBARG / TEACHING STUDIO</span>
            <div class="note-number">A⁺</div>
            <p>زمان کمتر برای چیدمان.<br /><b>تمرکز بیشتر روی آموزش.</b></p>
          </div>
        </section>
        <section class="product-stage" aria-label="نمای استودیو">
          <div class="stage-top">
            <span><i></i> آزمون میان‌ترم ریاضی</span
            ><span>پیش‌نمایش فضای طراحی</span>
          </div>
          <div class="stage-content">
            <aside>
              <small>ساختار آزمون</small>
              <div
                v-for="(q, i) in questions"
                :key="i"
                :class="{ current: i === 0 }"
              >
                <b>{{ fa(String(i + 1).padStart(2, "0")) }}</b
                >{{ q.title }}
              </div>
            </aside>
            <div class="stage-question">
              <span class="kicker">سؤال ۰۱ · چندگزینه‌ای</span>
              <h3>دانش را بسنجید، نه مهارت صفحه‌آرایی را.</h3>
              <p>{{ questions[0].body }}</p>
              <div class="equation" dir="ltr">x<sup>۲</sup> − ۵x + ۶ = ۰</div>
              <div class="sample-options">
                <span>◯ ۲ و ۳</span><span>◯ ۱ و ۶</span><span>◯ ۳ و ۴</span>
              </div>
            </div>
            <div class="stage-paper">
              <small>به نام خدا</small>
              <h4>آزمون میان‌ترم ریاضی</h4>
              <p>نام و نام خانوادگی: ………………</p>
              <hr />
              <b>۱. پاسخ درست را مشخص کنید.</b>
              <p dir="ltr">x<sup>۲</sup> − ۵x + ۶ = ۰</p>
              <hr />
              <b>۲. راه‌حل خود را بنویسید.</b>
              <div class="paper-lines"></div>
              <small>صفحه ۱ از ۲</small>
            </div>
          </div>
        </section>
        <section id="workflow" class="editorial-section">
          <div>
            <span class="kicker">یک روند روشن</span>
            <h2>شما مسیر یادگیری را می‌سازید.<br />ما برگه را مرتب می‌کنیم.</h2>
          </div>
          <ol>
            <li>
              <b>۰۱</b>
              <div>
                <h3>سؤال‌ها را بسازید</h3>
                <p>متن، فرمول، تصویر و شکل در یک ویرایشگر متمرکز.</p>
              </div>
            </li>
            <li>
              <b>۰۲</b>
              <div>
                <h3>به برگه شخصیت بدهید</h3>
                <p>سربرگ، قلم، بارم و فضای پاسخ مطابق کلاس شما.</p>
              </div>
            </li>
            <li>
              <b>۰۳</b>
              <div>
                <h3>با اطمینان چاپ کنید</h3>
                <p>نسخه دانش‌آموز و پاسخ‌نامه، آماده دریافت به صورت PDF.</p>
              </div>
            </li>
          </ol>
        </section>
        <section id="features" class="closing">
          <span class="kicker">کلاس بعدی از اینجا شروع می‌شود</span>
          <h2>ابزار حرفه‌ای.<br />برای کار هر روز شما.</h2>
          <button class="action light" @click="view = 'dashboard'">
            دیدن فضای کار <Icon name="left" />
          </button>
        </section>
      </main>
      <footer class="marketing-footer">
        <b>آزمون‌برگ</b><span>فرصت بیشتر برای آموزش.</span
        ><router-link to="/pricing">طرح‌ها و قیمت‌ها</router-link>
      </footer>
    </template>
    <div
      v-else
      class="workspace-grid"
      :class="{ 'studio-mode': view === 'studio' }"
    >
      <aside class="navigation">
        <button class="wordmark" @click="view = 'landing'">
          <Icon name="book" /> <span>آزمون‌برگ</span></button
        ><span class="nav-label">فضای کار مدرس</span
        ><button
          :class="{ active: view === 'dashboard' }"
          @click="view = 'dashboard'"
        >
          <Icon name="dashboard" /><span>آزمون‌های من</span></button
        ><button :class="{ active: view === 'studio' }" @click="openExam">
          <Icon name="file" /><span>استودیو آزمون</span></button
        ><router-link to="/account"
          ><Icon name="account" /><span>حساب کاربری</span></router-link
        ><router-link to="/pricing"
          ><Icon name="pricing" /><span>اشتراک و پرداخت</span></router-link
        >
        <div class="nav-bottom">
          <span class="avatar">م</span>
          <div><b>مریم احمدی</b><small>مدرس ریاضی</small></div>
        </div>
      </aside>
      <div class="workspace-body">
        <header class="workspace-header">
          <span>{{
            view === "dashboard"
              ? "فضای کار / آزمون‌های من"
              : "فضای کار / استودیو"
          }}</span>
          <AccountPopover
            name="مریم احمدی"
            plan="طرح استاندارد"
            :remaining="18"
            :limit="30"
            :days="21"
            :day-percent="70"
          />
        </header>
        <main v-if="view === 'dashboard'" class="dashboard-view">
          <div class="dashboard-title">
            <div>
              <span class="kicker">چهارشنبه، ۲۳ آبان</span>
              <h1>برای کلاس بعدی آماده‌اید؟</h1>
              <p>آزمون‌ها و ایده‌های شما، روی یک میز کار مرتب.</p>
            </div>
            <button class="action" @click="openExam">
              <Icon name="plus" /> آزمون جدید
            </button>
          </div>
          <div class="resume">
            <div>
              <span class="kicker">ادامهٔ آخرین کار</span>
              <h2>آزمون میان‌ترم ریاضی</h2>
              <p>پایه دهم · ۱۲ سؤال · ۲۰ نمره</p>
              <button @click="openExam">
                ادامه طراحی <Icon name="left" :size="18" />
              </button>
            </div>
            <div class="resume-art">
              <Icon name="file" :size="70" /><span>ریاضی / ۱۰</span>
            </div>
            <div class="resume-stat">
              <strong>۰۳</strong><span>آزمون در کتابخانه</span
              ><strong>۲۶</strong><span>سؤال طراحی‌شده</span>
            </div>
          </div>
          <section class="library">
            <div class="library-title">
              <h2>کتابخانه آزمون‌ها <small>۰۳</small></h2>
              <label
                ><Icon name="search" /><input
                  v-model="search"
                  placeholder="جست‌وجوی نام آزمون یا درس"
                  aria-label="جست‌وجوی آزمون"
              /></label>
            </div>
            <div class="table-head">
              <span>عنوان و درس</span><span>تعداد سؤال</span
              ><span>آخرین ویرایش</span><span></span>
            </div>
            <button
              v-for="exam in filtered"
              :key="exam.name"
              class="exam-row"
              @click="openExam"
            >
              <span class="exam-name"
                ><Icon name="file" /><span
                  ><b>{{ exam.name }}</b
                  ><small>{{ exam.course }}</small></span
                ></span
              ><span>{{ fa(exam.count) }} سؤال</span><span>{{ exam.date }}</span
              ><Icon name="left" :size="18" />
            </button>
            <p v-if="!filtered.length" class="empty">
              آزمونی با این عبارت پیدا نشد.
            </p>
          </section>
        </main>
        <main v-else class="studio">
          <header class="document-bar">
            <div>
              <span class="kicker">ریاضی · پایه دهم</span>
              <h1>آزمون میان‌ترم ریاضی</h1>
            </div>
            <span class="draft-note">پیش‌نویس نمونه · ذخیره نمی‌شود</span
            ><button
              class="secondary"
              @click="mobileTab = mobileTab === 'preview' ? 'edit' : 'preview'"
            >
              <Icon name="eye" :size="18" />
              {{ mobileTab === "preview" ? "بازگشت به ویرایش" : "پیش‌نمایش" }}
            </button>
          </header>
          <nav class="studio-tabs">
            <button
              v-for="(label, key) in {
                outline: 'سؤال‌ها',
                edit: 'ویرایش',
                settings: 'تنظیمات',
                preview: 'پیش‌نمایش',
              }"
              :key="key"
              :aria-pressed="mobileTab === key"
              @click="mobileTab = key"
            >
              {{ label }}
            </button>
          </nav>
          <div class="studio-columns" :data-tab="mobileTab">
            <aside class="question-outline">
              <div class="outline-title">
                <b>سؤال‌ها</b><span>{{ fa(questions.length) }}</span>
              </div>
              <button
                v-for="(q, i) in questions"
                :key="i"
                :class="{ selected: i === selected }"
                @click="
                  selected = i;
                  mobileTab = 'edit';
                "
              >
                <span class="question-index">{{
                  fa(String(i + 1).padStart(2, "0"))
                }}</span
                ><span
                  ><b>{{ q.title || "سؤال جدید" }}</b
                  ><small>{{ q.type }} · {{ fa(q.score) }} نمره</small></span
                ></button
              ><button class="add-question" @click="add">
                <Icon name="plus" :size="18" /> افزودن سؤال
              </button>
            </aside>
            <section class="question-canvas">
              <section
                v-if="mobileTab === 'preview'"
                class="real-paper-preview"
                aria-label="پیش‌نمایش قالب اصلی آزمون"
              >
                <div class="paper-controls">
                  <label
                    >نسخه برگه<select v-model="paperKind" aria-label="نسخه برگه">
                      <option value="student">دانش‌آموز</option>
                      <option value="answer-key">پاسخ‌نامه مدرس</option>
                    </select></label
                  ><span>همان قالب و چیدمان خروجی PDF</span>
                </div>
                <PaperPreview :exam="previewExam" :kind="paperKind" />
              </section>
              <template v-else
                ><div class="canvas-heading">
                  <span class="kicker"
                    >سؤال {{ fa(selected + 1) }} از
                    {{ fa(questions.length) }}</span
                  >
                  <div>
                    <button
                      aria-label="انتقال سؤال به بالا"
                      :disabled="selected === 0"
                      @click="move(-1)"
                    >
                      <Icon name="up" :size="18" /></button
                    ><button
                      aria-label="انتقال سؤال به پایین"
                      :disabled="selected === questions.length - 1"
                      @click="move(1)"
                    >
                      <Icon name="down" :size="18" />
                    </button>
                  </div>
                </div>
                <label class="field-label"
                  >عنوان سؤال<input
                    v-model="question.title"
                    class="question-title" /></label
                ><label class="field-label"
                  >متن سؤال<textarea
                    v-model="question.body"
                    rows="5"
                    placeholder="سؤال خود را اینجا بنویسید…"
                  />
                </label>
                <div v-if="selected === 0" class="equation" dir="ltr">
                  x<sup>۲</sup> − ۵x + ۶ = ۰
                </div>
                <fieldset
                  v-if="question.type === 'چندگزینه‌ای'"
                  class="options"
                >
                  <legend>گزینه‌های پاسخ</legend>
                  <label
                    v-for="(option, i) in ['۲ و ۳', '۱ و ۶', '۳ و ۴', '۱ و ۵']"
                    :key="option"
                    ><input type="radio" name="answer" :value="i" />{{
                      option
                    }}</label
                  >
                </fieldset>
                <div class="canvas-footer">
                  <span>هر سؤال، یک فضای متمرکز برای فکر کردن.</span
                  ><button class="secondary" @click="add">
                    سؤال بعدی <Icon name="plus" :size="16" />
                  </button></div
              ></template>
            </section>
            <aside class="inspector">
              <section class="exam-layout-settings">
                <span class="kicker">قالب اصلی آزمون</span
                ><label class="field-label"
                  >نوع سربرگ<select v-model="paperTemplate" aria-label="نوع سربرگ">
                    <option value="school">مدرسه</option>
                    <option value="university">دانشگاه</option>
                  </select></label
                ><label class="field-label"
                  >چیدمان برگه<select v-model="paperStyle" aria-label="چیدمان برگه">
                    <option
                      v-for="style in printStyles"
                      :key="style.id"
                      :value="style.id"
                    >
                      {{ style.label }} — {{ style.detail }}
                    </option>
                  </select></label
                ><button class="secondary" @click="mobileTab = 'preview'">
                  مشاهده برگه با این قالب
                </button>
                <p>هر ده قالب قبلی، با همان سربرگ، بارم‌بندی و صفحه‌بندی.</p>
              </section>
              <span class="kicker">تنظیمات سؤال</span>
              <h2>جزئیات و بارم</h2>
              <label class="field-label"
                >نوع سؤال<select v-model="question.type">
                  <option>چندگزینه‌ای</option>
                  <option>تشریحی</option>
                </select></label
              ><label class="field-label"
                >نمره<input
                  :value="fa(question.score)"
                  inputmode="decimal"
                  @input="
                    question.score = englishDigits($event.target.value).replace(
                      '٫',
                      '.',
                    )
                  "
              /></label>
              <div class="inspector-note">
                <Icon name="help" />
                <p>بارم هر سؤال در برگه نهایی کنار آن نمایش داده می‌شود.</p>
              </div>
              <hr />
              <span class="kicker">نمای کلی آزمون</span>
              <div class="summary-line">
                <span>تعداد سؤال</span><b>{{ fa(questions.length) }}</b>
              </div>
              <div class="summary-line">
                <span>جمع نمره</span
                ><b>{{
                  fa(questions.reduce((n, q) => n + Number(q.score || 0), 0))
                }}</b>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
<style scoped src="./precision.css"></style>
