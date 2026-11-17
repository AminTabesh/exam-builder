<script setup>
import { useRouter } from "vue-router";
import { useExams } from "./features/exams/store.js";
import { persianDigits as fa } from "./lib/numbers.js";
import Icon from "./components/Icon.vue";
const router = useRouter(),
  store = useExams();
const questions = [
  {
    title: "ریشه‌های معادله درجه دوم",
    body: "ریشه‌های معادله زیر را به دست آورید و گزینه درست را انتخاب کنید.",
  },
  { title: "تابع و نمودار" },
  { title: "احتمال یک پیشامد" },
];
</script>
<template>
  <div class="precision" dir="rtl">
    <header class="marketing-header">
      <a href="#" class="wordmark" @click.prevent="router.push('/')"
        ><Icon name="book" /> آزمون‌برگ<span>ابزار کار مدرس</span></a
      >
      <nav>
        <a href="#workflow">روش کار</a><a href="#features">امکانات</a
        ><router-link to="/pricing">طرح‌ها</router-link>
      </nav>
      <button
        class="action"
        @click="router.push(store.user ? '/dashboard' : '/account')"
      >
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
            <button
              class="action"
              @click="router.push(store.user ? '/dashboard' : '/account')"
            >
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
        <button
          class="action light"
          @click="router.push(store.user ? '/dashboard' : '/account')"
        >
          دیدن فضای کار <Icon name="left" />
        </button>
      </section>
    </main>
    <footer class="marketing-footer">
      <b>آزمون‌برگ</b><span>فرصت بیشتر برای آموزش.</span
      ><router-link to="/pricing">طرح‌ها و قیمت‌ها</router-link>
    </footer>
  </div>
</template>
<style scoped src="./design/precision.css"></style>
