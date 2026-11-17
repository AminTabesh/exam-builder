<script setup>
import { ref, computed } from "vue";
import Icon from "../../../components/Icon.vue";
import AppSlider from "../../../components/AppSlider.vue";
import {
  defaultParabola,
  parabolaSchema,
  parabolaSvg,
  graphGeometry,
  autoViewport,
  quadratic,
  graphNumber,
} from "@exam/shared/parabola.js";
const props = defineProps({ initial: Object });
const emit = defineEmits(["save", "cancel"]);
const draft = ref({
  ...defaultParabola(),
  ...JSON.parse(JSON.stringify(props.initial || {})),
});
const fields = ref({}),
  error = ref(""),
  pointError = ref(""),
  addMode = ref(false),
  snap = ref(false),
  pointX = ref(draft.value.numericMode === "fa" ? "۰" : "0"),
  pointY = ref(draft.value.numericMode === "fa" ? "۰" : "0"),
  pointLabel = ref("A");
const keys = ["a", "b", "c", "xmin", "xmax", "ymin", "ymax"];
const format = (n) => graphNumber(n, draft.value.numericMode);
// Numeric mode changes presentation without rounding saved coefficients or points.
const formatInput = (n) =>
  draft.value.numericMode === "fa"
    ? String(n)
        .replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d])
        .replace(/\./g, "٫")
    : String(n);
const parse = (value) => {
  const text = String(value)
    .trim()
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/٫/g, ".")
    .replace(/−/g, "-");
  return text ? Number(text) : NaN;
};
function sync() {
  for (const k of keys) fields.value[k] = formatInput(draft.value[k]);
}
sync();
function validate() {
  const p = { ...draft.value };
  for (const k of keys) p[k] = parse(fields.value[k]);
  const result = parabolaSchema.safeParse(p);
  if (!result.success) {
    error.value =
      result.error.issues.find((issue) => issue.code === "custom")?.message ||
      "ضرایب و بازه‌ها باید عدد معتبر باشند؛ انتهای هر محور باید از ابتدا بزرگ‌تر باشد.";
    return false;
  }
  draft.value = result.data;
  error.value = "";
  return true;
}
function numericMode(mode) {
  if (!validate()) return;
  draft.value.numericMode = mode;
  for (const field of [pointX, pointY]) {
    const value = parse(field.value);
    if (Number.isFinite(value)) field.value = formatInput(value);
  }
  sync();
}
function reset() {
  if (validate()) {
    Object.assign(draft.value, autoViewport(draft.value));
    sync();
  }
}
function restore() {
  draft.value = defaultParabola();
  sync();
  error.value = "";
  pointError.value = "";
  addMode.value = false;
  snap.value = false;
  pointX.value = "۰";
  pointY.value = "۰";
  pointLabel.value = "A";
}
function setKind(kind) {
  const a = kind === "linear" ? 0 : 1;
  const b = kind === "linear" ? 1 : 0;
  const c = Number.isFinite(parse(fields.value.c)) ? parse(fields.value.c) : 0;
  Object.assign(
    draft.value,
    { kind, a, b, c },
    autoViewport({ kind, a, b, c }),
  );
  error.value = "";
  sync();
}
function preset(a, b, c, kind = "quadratic") {
  if (!validate()) return;
  Object.assign(
    draft.value,
    { kind, a, b, c },
    autoViewport({ kind, a, b, c }),
  );
  sync();
}
function setOpening(value) {
  if (!validate()) return;
  const { x, y } = quadratic(draft.value);
  const a = Math.sign(draft.value.a) * value;
  apply({ a, b: -2 * a * x, c: y + a * x * x });
}
function flip() {
  if (!validate()) return;
  const { x, y } = quadratic(draft.value),
    a = -draft.value.a;
  apply({ a, b: -2 * a * x, c: y + a * x * x });
}
function apply(candidate) {
  const result = parabolaSchema.safeParse({ ...draft.value, ...candidate });
  if (result.success) {
    draft.value = result.data;
    sync();
    error.value = "";
    return true;
  }
  error.value = "مقدار خارج از محدودهٔ مجاز است.";
  return false;
}
const stats = computed(() => quadratic(draft.value));
function vertexInput(axis, event) {
  if (!validate()) return;
  const n = parse(event.target.value);
  if (!Number.isFinite(n)) {
    error.value = "مختصات رأس باید عدد باشد.";
    return;
  }
  const x = axis === "x" ? n : stats.value.x,
    y = axis === "y" ? n : stats.value.y,
    a = draft.value.a;
  apply({ b: -2 * a * x, c: y + a * x * x });
}
const pointOnCurve = (x) =>
  draft.value.a * x * x + draft.value.b * x + draft.value.c;
function addPoint(x = parse(pointX.value), y = parse(pointY.value)) {
  if (!validate()) return;
  if (snap.value) y = pointOnCurve(x);
  const points = [
    ...draft.value.points,
    { x, y, label: pointLabel.value.trim() },
  ];
  if (!parabolaSchema.safeParse({ ...draft.value, points }).success) {
    pointError.value =
      "مختصات معتبر وارد کنید؛ حداکثر ۳۰ نقطه و ۴۰ نویسه برای نام مجاز است.";
    return;
  }
  draft.value.points = points;
  pointError.value = "";
  pointLabel.value = String.fromCharCode(65 + (points.length % 26));
}
function updatePoint(index, key, value) {
  const points = draft.value.points.map((p) => ({ ...p }));
  points[index][key] = ["label", "color", "showInfo"].includes(key)
    ? value
    : parse(value);
  if (snap.value && key === "x")
    points[index].y = pointOnCurve(points[index].x);
  if (parabolaSchema.safeParse({ ...draft.value, points }).success) {
    draft.value.points = points;
    pointError.value = "";
  } else
    pointError.value =
      "مختصات نقطه باید عدد معتبر و نام آن حداکثر ۴۰ نویسه باشد.";
}
const outOfView = computed(() => {
  const geo = graphGeometry(draft.value);
  return draft.value.points.filter((p) => {
    const [x, y] = geo.toPixel(p.x, p.y);
    return x < 40 || x > 360 || y < 40 || y > 360;
  }).length;
});
function fitPoints() {
  if (!validate()) return;
  const points = [
    ...draft.value.points,
    { x: stats.value.x, y: stats.value.y },
    ...stats.value.roots.map((x) => ({ x, y: 0 })),
  ];
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  apply({
    xmin: Math.max(-100000, Math.min(...xs) - 2),
    xmax: Math.min(100000, Math.max(...xs) + 2),
    ymin: Math.max(-100000, Math.min(...ys) - 2),
    ymax: Math.min(100000, Math.max(...ys) + 2),
  });
}
const Preview = {
  render: () => parabolaSvg(draft.value, { interactive: true }),
};
const drag = ref(null);
function coordinates(e, geometry, bounds, curveSnap = snap.value) {
  let [x, y] = geometry.toMath(
    ((e.clientX - bounds.left) * 400) / bounds.width,
    ((e.clientY - bounds.top) * 400) / bounds.height,
  );
  x = Number(x.toFixed(3));
  y = Number(y.toFixed(3));
  return [x, curveSnap ? pointOnCurve(x) : y];
}
function start(e) {
  if (e.button !== 0 || !validate()) return;
  const vertex = e.target.closest("[data-vertex]"),
    dot = e.target.closest("[data-point]");
  const svg = e.currentTarget.querySelector("svg"),
    bounds = svg.getBoundingClientRect(),
    geometry = graphGeometry(draft.value);
  if (!vertex && !dot) {
    if (addMode.value) {
      const px = ((e.clientX - bounds.left) * 400) / bounds.width,
        py = ((e.clientY - bounds.top) * 400) / bounds.height;
      if (px >= 40 && px <= 360 && py >= 40 && py <= 360)
        addPoint(...coordinates(e, geometry, bounds));
    }
    return;
  }
  e.preventDefault();
  drag.value = {
    geometry,
    bounds,
    saved: structuredClone({
      ...draft.value,
      points: draft.value.points.map((p) => ({ ...p })),
    }),
    index: dot ? Number(dot.dataset.point) : -1,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
}
function move(e) {
  if (!drag.value) return;
  const g = drag.value;
  const [x, y] = coordinates(
    e,
    g.geometry,
    g.bounds,
    g.index >= 0 && snap.value,
  );
  const candidate =
    g.index < 0
      ? { b: -2 * g.saved.a * x, c: y + g.saved.a * x * x }
      : {
          points: draft.value.points.map((p, i) =>
            i === g.index ? { ...p, x, y } : p,
          ),
        };
  if (parabolaSchema.safeParse({ ...draft.value, ...candidate }).success) {
    Object.assign(draft.value, candidate);
    sync();
  }
}
function cancel() {
  if (drag.value) {
    draft.value = drag.value.saved;
    sync();
    drag.value = null;
  }
}
function save() {
  if (validate() && !pointError.value)
    emit(
      "save",
      structuredClone({
        ...draft.value,
        points: draft.value.points.map((p) => ({ ...p })),
      }),
    );
}
</script>
<template>
  <section
    class="parabola-dialog"
    dir="rtl"
    @keydown.esc.stop="drag ? cancel() : emit('cancel')"
  >
    <header class="graph-header">
      <span class="graph-header-icon"><Icon name="parabola" :size="26" /></span>
      <div>
        <span class="graph-eyebrow">طراحی نمودار ریاضی</span>
        <h2>نمودار را به روش خودتان بسازید</h2>
        <p>
          معادله را وارد کنید، نقطه‌ها را بسازید و جزئیات دلخواه را نمایش دهید.
        </p>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="بستن ویرایشگر نمودار"
        @click="emit('cancel')"
      >
        <Icon name="close" :size="20" />
      </button>
    </header>
    <div class="parabola-layout">
      <div class="graph-stage">
        <div class="preview-heading">
          <span><i></i>پیش‌نمایش زنده</span
          ><span class="numeric-switch" role="group" aria-label="نوع اعداد"
            ><button
              type="button"
              :aria-pressed="draft.numericMode === 'fa'"
              @click="numericMode('fa')"
            >
              ۱۲۳ فارسی</button
            ><button
              type="button"
              :aria-pressed="draft.numericMode === 'en'"
              @click="numericMode('en')"
            >
              123 لاتین
            </button></span
          >
        </div>
        <div
          class="parabola-preview"
          :class="{ 'adding-points': addMode }"
          @pointerdown="start"
          @pointermove="move"
          @pointerup="drag = null"
          @pointercancel="cancel"
        >
          <Preview />
        </div>
        <p class="preview-hint">
          <Icon :name="addMode ? 'plus' : 'drag'" :size="16" />{{
            addMode
              ? "برای افزودن نقطه، داخل نمودار کلیک یا لمس کنید."
              : "نقطه‌های سفارشی و رأس سهمی را بکشید؛ Escape برای لغو."
          }}
        </p>
        <div class="graph-summary">
          <div v-if="draft.kind !== 'linear'">
            <span>رأس سهمی</span
            ><strong dir="ltr"
              >({{ format(stats.x) }}, {{ format(stats.y) }})</strong
            >
          </div>
          <div>
            <span>ریشه‌های حقیقی</span
            ><strong dir="ltr">{{
              stats.roots.length
                ? stats.roots.map(format).join(" , ")
                : "بدون ریشهٔ حقیقی"
            }}</strong>
          </div>
        </div>
        <div class="preview-actions">
          <button type="button" @click="reset">
            <Icon name="search" :size="16" />بازنشانی نما</button
          ><button type="button" @click="fitPoints">نمایش همهٔ نقطه‌ها</button>
        </div>
        <p v-if="outOfView" class="graph-notice" role="status">
          {{ format(outOfView) }} نقطه خارج از نماست؛ «نمایش همهٔ نقطه‌ها» را
          بزنید.
        </p>
      </div>
      <div class="parabola-controls">
        <section class="graph-panel">
          <h3><span class="panel-step">۰۱</span> معادله و شکل نمودار</h3>
          <p class="panel-hint">
            نوع نمودار را انتخاب کنید و ضرایب را تغییر دهید.
          </p>
          <div class="equation-kind" role="group" aria-label="نوع معادله">
            <button
              type="button"
              :aria-pressed="draft.kind !== 'linear'"
              aria-label="معادله درجه دو"
              @click="setKind('quadratic')"
            >
              <span class="kind-formula" dir="ltr">x²</span
              ><strong>معادله درجه دو</strong><small>سهمی و رأس</small>
            </button>
            <button
              type="button"
              :aria-pressed="draft.kind === 'linear'"
              aria-label="معادله درجه یک"
              @click="setKind('linear')"
            >
              <span class="kind-formula" dir="ltr">x</span
              ><strong>معادله درجه یک</strong><small>خط و شیب</small>
            </button>
          </div>
          <p class="panel-hint" dir="ltr">
            {{ draft.kind === "linear" ? "y = bx + c" : "y = ax² + bx + c" }}
          </p>
          <div class="coefficient-row">
            <label
              v-for="key in draft.kind === 'linear'
                ? ['b', 'c']
                : ['a', 'b', 'c']"
              :key="key"
              ><span>{{ key }}</span
              ><input
                v-model="fields[key]"
                :aria-label="`ضریب ${key}`"
                dir="ltr"
                inputmode="decimal"
                @input="validate"
                @blur="!error && sync()"
            /></label>
          </div>
          <div v-if="draft.kind !== 'linear'" class="preset-row">
            <span>شروع سریع</span
            ><button type="button" @click="preset(1, 0, 0)">y = x²</button
            ><button type="button" @click="preset(-1, 0, 4)">y = −x² + 4</button
            ><button type="button" @click="preset(1, -2, -3)">دو ریشه</button>
          </div>
          <div v-else class="preset-row">
            <span>شروع سریع</span>
            <button type="button" @click="preset(0, 1, 0, 'linear')">
              y = x
            </button>
            <button type="button" @click="preset(0, -1, 2, 'linear')">
              y = −x + 2
            </button>
            <button type="button" @click="preset(0, 2, -2, 'linear')">
              y = 2x − 2
            </button>
          </div>
          <AppSlider
            v-if="draft.kind !== 'linear'"
            label="ضریب بازشدگی"
            :min="0.05"
            :max="Math.max(5, Math.abs(draft.a))"
            :step="0.05"
            :model-value="Math.abs(draft.a)"
            :persian="draft.numericMode === 'fa'"
            @update:model-value="setOpening"
          />
          <button
            v-if="draft.kind !== 'linear'"
            class="direction-button"
            type="button"
            @click="flip"
          >
            <Icon :name="draft.a > 0 ? 'down' : 'up'" :size="16" />{{
              draft.a > 0 ? "تغییر جهت به پایین" : "تغییر جهت به بالا"
            }}
          </button>
          <div v-if="draft.kind !== 'linear'" class="vertex-fields">
            <label
              >مختصات x رأس<input
                :value="formatInput(stats.x)"
                aria-label="مختصات x رأس"
                dir="ltr"
                inputmode="decimal"
                @change="vertexInput('x', $event)" /></label
            ><label
              >مختصات y رأس<input
                :value="formatInput(stats.y)"
                aria-label="مختصات y رأس"
                dir="ltr"
                inputmode="decimal"
                @change="vertexInput('y', $event)"
            /></label>
          </div>
        </section>
        <section class="graph-panel">
          <h3><span class="panel-step">۰۲</span> جزئیات قابل نمایش</h3>
          <p class="panel-hint">
            فقط اطلاعاتی را نشان دهید که دانش‌آموز باید ببیند.
          </p>
          <div class="graph-toggles">
            <label
              v-for="(text, key) in {
                axes: 'محورها',
                grid: 'شبکه',
                equation: 'معادله',
                vertex: 'رأس',
                roots: 'نقطه‌های ریشه',
                rootLabels: 'اطلاعات ریشه‌ها',
                pointLabels: 'اطلاعات نقطه‌های سفارشی',
                pointCoordinates: 'مختصات نقطه‌ها',
              }"
              :key="key"
              class="check-label"
              ><input
                v-model="draft[key]"
                type="checkbox"
                :disabled="key === 'vertex' && draft.kind === 'linear'"
              /><span>{{ text }}</span></label
            >
          </div>
        </section>
        <section class="graph-panel">
          <h3>
            <span class="panel-step">۰۳</span> نقطه‌های سفارشی
            <span>{{ format(draft.points.length) }} / {{ format(30) }}</span>
          </h3>
          <p class="panel-hint">
            مختصات دلخواه را وارد کنید یا نقطه را روی نمودار قرار دهید.
          </p>
          <div class="point-tools">
            <button
              type="button"
              :aria-pressed="addMode"
              @click="addMode = !addMode"
            >
              <Icon name="plus" :size="16" />افزودن با کلیک</button
            ><label class="check-label"
              ><input v-model="snap" type="checkbox" />روی منحنی</label
            >
          </div>
          <div class="point-entry">
            <label
              >نام<input
                v-model="pointLabel"
                aria-label="نام نقطه جدید"
                maxlength="40" /></label
            ><label
              >x<input
                v-model="pointX"
                aria-label="مختصات x نقطه جدید"
                dir="ltr"
                inputmode="decimal" /></label
            ><label
              >y<input
                v-model="pointY"
                aria-label="مختصات y نقطه جدید"
                dir="ltr"
                inputmode="decimal"
                :disabled="snap" /></label
            ><button
              type="button"
              aria-label="افزودن نقطه"
              :disabled="draft.points.length >= 30"
              @click="addPoint()"
            >
              <Icon name="plus" :size="18" />
            </button>
          </div>
          <ul v-if="draft.points.length" class="point-list">
            <li v-for="(point, index) in draft.points" :key="index">
              <input
                :value="point.label"
                :aria-label="`نام نقطه ${index + 1}`"
                maxlength="40"
                @change="updatePoint(index, 'label', $event.target.value)"
              /><input
                :value="formatInput(point.x)"
                :aria-label="`مختصات x نقطه ${index + 1}`"
                dir="ltr"
                inputmode="decimal"
                @change="updatePoint(index, 'x', $event.target.value)"
              /><input
                :value="formatInput(point.y)"
                :aria-label="`مختصات y نقطه ${index + 1}`"
                dir="ltr"
                inputmode="decimal"
                @change="updatePoint(index, 'y', $event.target.value)"
              /><button
                class="icon-button"
                type="button"
                :aria-label="`حذف نقطه ${index + 1}`"
                @click="
                  draft.points.splice(index, 1);
                  pointError = '';
                "
              >
                <Icon name="trash" :size="17" />
              </button>
              <div class="point-options">
                <label
                  >رنگ<input
                    type="color"
                    :value="point.color || draft.pointColor || draft.color"
                    :aria-label="`رنگ نقطه ${index + 1}`"
                    @input="updatePoint(index, 'color', $event.target.value)"
                /></label>
                <label class="check-label"
                  ><input
                    type="checkbox"
                    :checked="point.showInfo !== false"
                    :aria-label="`نمایش اطلاعات نقطه ${index + 1}`"
                    @change="
                      updatePoint(index, 'showInfo', $event.target.checked)
                    "
                  />نمایش اطلاعات</label
                >
              </div>
            </li>
          </ul>
          <p v-else class="empty-points">هنوز نقطه‌ای اضافه نشده است.</p>
          <p v-if="pointError" role="alert" class="field-error">
            {{ pointError }}
          </p>
        </section>
        <details class="graph-panel">
          <summary>
            <span><span class="panel-step">۰۴</span> رنگ و تنظیمات نما</span>
            <Icon name="settings" :size="17" />
          </summary>
          <fieldset>
            <legend>بازهٔ محورها</legend>
            <label
              v-for="(text, key) in {
                xmin: 'ابتدای x',
                xmax: 'انتهای x',
                ymin: 'ابتدای y',
                ymax: 'انتهای y',
              }"
              :key="key"
              >{{ text
              }}<input
                v-model="fields[key]"
                :aria-label="text"
                dir="ltr"
                inputmode="decimal"
                @input="validate"
            /></label>
          </fieldset>
          <div class="color-row" role="group" aria-label="رنگ منحنی">
            <span>رنگ منحنی</span
            ><button
              v-for="(label, color) in {
                '#2457d6': 'آبی',
                '#32735c': 'سبز',
                '#a43232': 'قرمز',
                '#172b4d': 'سرمه‌ای',
              }"
              :key="color"
              type="button"
              :aria-label="label"
              :aria-pressed="draft.color === color"
              :style="{ '--swatch': color }"
              class="color-swatch"
              @click="draft.color = color"
            >
              <Icon v-if="draft.color === color" name="check" :size="14" />
            </button>
          </div>
          <div class="marker-colors">
            <label
              v-for="(label, key) in {
                pointColor: 'رنگ پیش‌فرض نقطه‌ها',
                rootColor: 'رنگ ریشه‌ها',
                vertexColor: 'رنگ رأس',
              }"
              :key="key"
              >{{ label
              }}<input
                type="color"
                :aria-label="label"
                :value="
                  draft[key] || (key === 'pointColor' ? draft.color : '#a43232')
                "
                @input="draft[key] = $event.target.value"
            /></label>
          </div>
          <AppSlider
            v-model="draft.lineWidth"
            label="ضخامت خط"
            :min="1"
            :max="5"
            :step="0.5"
            :persian="draft.numericMode === 'fa'"
          />
        </details>
        <p v-if="error" role="alert" class="field-error">{{ error }}</p>
      </div>
    </div>
    <footer class="graph-footer">
      <button type="button" class="graph-save" @click="save">
        <Icon name="check" :size="18" /><span>{{
          draft.kind === "linear" ? "ذخیره نمودار" : "ذخیره سهمی"
        }}</span></button
      ><button type="button" @click="emit('cancel')">انصراف</button
      ><button type="button" class="restore-button" @click="restore">
        شروع دوباره
      </button>
    </footer>
  </section>
</template>
<style scoped>
.point-options {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dce3ed;
}
.point-options label,
.marker-colors label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.point-options input[type="color"],
.marker-colors input[type="color"] {
  width: 32px;
  height: 32px;
  padding: 2px;
  cursor: pointer;
}
.marker-colors {
  display: grid;
  gap: 10px;
  margin-block: 16px;
}

.parabola-dialog {
  --graph-blue: var(--navy, #2457d6);
  padding: 24px;
  color: var(--ink, #172b4d);
  background: white;
}
.graph-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.graph-header-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #edf3ff;
  color: var(--graph-blue);
  flex-shrink: 0;
}
.graph-header h2 {
  font-size: 19px;
  margin: 0;
}
.graph-header p {
  font-size: 12px;
  color: var(--muted, #586980);
  margin: 5px 0 0;
}
.graph-header > .icon-button {
  margin-inline-start: auto;
}
.parabola-layout {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(280px, 340px);
  gap: 22px;
  align-items: start;
}
.graph-stage {
  position: sticky;
  top: 0;
  border: 1px solid var(--line, #dde5f0);
  border-radius: 14px;
  background: #f7f9fe;
  padding: 12px;
}
.preview-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 12px;
}
.preview-heading > span:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-heading i {
  height: 6px;
  width: 6px;
  background: #32735c;
  border-radius: 50%;
}
.numeric-switch {
  display: flex;
  padding: 3px;
  background: #e8eef8;
  border-radius: 8px;
}
.numeric-switch button {
  border: 0;
  padding: 5px 8px;
  font-size: 10px;
  background: transparent;
}
.numeric-switch button[aria-pressed="true"] {
  background: white;
  color: var(--graph-blue);
  box-shadow: 0 1px 4px #172b4d12;
}
.parabola-preview {
  border: 1px solid var(--line, #dde5f0);
  border-radius: 10px;
  overflow: hidden;
  touch-action: none;
  background: white;
}
.adding-points {
  cursor: crosshair;
}
.preview-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--muted, #586980);
  margin: 12px 0;
}
.graph-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line, #dde5f0);
  border-radius: 9px;
  background: white;
}
.graph-summary > div {
  display: grid;
  gap: 5px;
  padding: 10px;
  min-width: 0;
}
.graph-summary > div + div {
  border-inline-start: 1px solid var(--line, #dde5f0);
}
.graph-summary span {
  font-size: 10px;
  color: var(--muted, #586980);
}
.graph-summary strong {
  font-size: 11px;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.preview-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.preview-actions button {
  flex: 1;
  font-size: 10px;
  padding: 7px;
}
.graph-notice {
  font-size: 11px;
  color: #925c14;
  background: #fff7e6;
  border-radius: 7px;
  padding: 8px;
  margin: 10px 0 0;
}
.parabola-controls {
  display: grid;
  gap: 12px;
}
.graph-panel {
  border: 1px solid var(--line, #dde5f0);
  border-radius: 12px;
  padding: 14px;
  display: grid;
  gap: 14px;
}
.graph-panel h3 {
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
}
.graph-panel h3 span {
  font-size: 10px;
  color: var(--muted, #586980);
  font-weight: 400;
}
.panel-hint {
  font-size: 11px;
  color: var(--muted, #586980);
  margin: -5px 0 0;
}
.coefficient-row,
.vertex-fields {
  display: flex;
  gap: 8px;
}
.coefficient-row label,
.vertex-fields label {
  flex: 1;
  min-width: 0;
}
label {
  display: grid;
  gap: 6px;
  font-size: 11px;
  color: var(--muted, #586980);
}
.coefficient-row label > span {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink, #172b4d);
  text-align: center;
}
.coefficient-row input {
  text-align: center;
  background: #f7f9fe !important;
  font-size: 15px !important;
}
input:not([type="checkbox"]):not([type="range"]) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line, #dde5f0);
  border-radius: 7px;
  padding: 8px;
  background: white;
  color: var(--ink, #172b4d);
  font-size: 12px;
}
input:disabled {
  background: #f1f4f9 !important;
  color: #8d9da9;
}
.preset-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.preset-row span {
  font-size: 10px;
  color: var(--muted, #586980);
}
.preset-row button {
  font-size: 10px;
  padding: 4px 7px;
  direction: ltr;
}
.direction-button {
  font-size: 11px;
  color: var(--graph-blue);
  background: #f7f9fe;
}
.point-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.point-tools button {
  font-size: 11px;
  padding: 6px 9px;
}
.point-tools button[aria-pressed="true"] {
  background: #edf3ff;
  color: var(--graph-blue);
  border-color: var(--graph-blue);
}
.check-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  cursor: pointer;
}
.check-label input {
  accent-color: var(--graph-blue);
  width: 15px;
  height: 15px;
}
.point-entry {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 32px;
  gap: 5px;
  align-items: end;
}
.point-entry > button {
  padding: 8px 5px;
  height: 34px;
  background: #edf3ff;
  color: var(--graph-blue);
}
.point-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
  max-height: 200px;
  overflow: auto;
}
.point-list li {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 28px;
  gap: 5px;
  align-items: center;
}
.point-list input {
  padding: 6px !important;
  font-size: 11px !important;
}
.empty-points {
  font-size: 11px;
  text-align: center;
  color: var(--muted, #586980);
  margin: 0;
  padding: 10px;
  border: 1px dashed var(--line, #dde5f0);
  border-radius: 7px;
}
details.graph-panel {
  display: block;
}
summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  list-style: none;
}
details[open] > summary {
  margin-bottom: 16px;
}
fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line, #dde5f0);
  border-radius: 8px;
}
legend {
  font-size: 10px;
  padding: 0 6px;
}
.graph-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 14px;
  font-size: 11px;
}
.color-row > span {
  margin-inline-end: auto;
}
.color-swatch:hover {
  background: var(--swatch);
}
.color-swatch {
  height: 26px;
  width: 26px;
  border-radius: 50%;
  padding: 0;
  display: grid;
  place-items: center;
  background: var(--swatch);
  color: white;
  border: 3px solid white;
  box-shadow: 0 0 0 1px var(--line, #dde5f0);
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  border: 1px solid var(--line, #dde5f0);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  background: white;
  transition: background 0.15s;
}
button:hover {
  background: #f1f5fd;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.icon-button {
  padding: 6px;
  border: 0;
  color: var(--muted, #586980);
}
footer {
  display: flex;
  gap: 8px;
  align-items: center;
  border-top: 1px solid var(--line, #dde5f0);
  padding-top: 18px;
  margin-top: 22px;
  font-size: 12px;
}
.graph-save {
  background: var(--graph-blue);
  border-color: var(--graph-blue);
  color: white;
}
.graph-save:hover {
  background: #1c46ad;
}
.restore-button {
  margin-inline-start: auto;
  border: 0;
  color: var(--muted, #586980);
  font-size: 11px;
}
button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--graph-blue);
  outline-offset: 3px;
}
.field-error {
  font-size: 11px;
  margin: 0;
}
@media (max-width: 650px) {
  .parabola-layout {
    grid-template-columns: 1fr;
  }
  .parabola-dialog {
    padding: 14px;
  }
  .graph-stage {
    position: static;
  }
  .graph-header {
    margin-bottom: 16px;
  }
  .graph-header h2 {
    font-size: 17px;
  }
  .graph-header p {
    font-size: 10px;
  }
  .preview-heading {
    flex-wrap: wrap;
  }
  .parabola-preview {
    max-width: 340px;
    margin: auto;
  }
  .graph-summary strong {
    font-size: 10px;
  }
}

/* The graph remains visible while the settings read as a short guided form. */
.parabola-dialog {
  padding: 28px;
  background: #f6f8fc;
  border-radius: 24px;
}
.graph-header {
  margin-bottom: 24px;
  align-items: flex-start;
}
.graph-header-icon {
  width: 52px;
  height: 52px;
  background: #e7efff;
  border: 1px solid #d8e4fb;
  border-radius: 18px;
}
.graph-eyebrow {
  display: block;
  font-size: 10px;
  color: #62738b;
  margin-bottom: 4px;
}
.graph-header h2 {
  font-size: 20px;
  line-height: 1.7;
}
.graph-header p {
  font-size: 11px;
  line-height: 1.9;
}
.parabola-layout {
  grid-template-columns: minmax(300px, 1fr) minmax(300px, 1fr);
  gap: 24px;
}
.parabola-controls {
  grid-column: 1;
  grid-row: 1;
  gap: 16px;
  min-width: 0;
}
.graph-stage {
  grid-column: 2;
  grid-row: 1;
  background: white;
  padding: 18px;
  border-radius: 22px;
  box-shadow: 0 6px 24px #172b4905;
  min-width: 0;
}
.parabola-preview {
  border-radius: 16px;
}
.graph-panel {
  border-color: #e0e7f1;
  background: white;
  padding: 20px;
  gap: 16px;
  border-radius: 20px;
}
.graph-panel h3 {
  justify-content: flex-start;
  align-items: center;
  font-size: 13px;
  line-height: 1.7;
}
.graph-panel h3 > span:last-child:not(.panel-step) {
  margin-inline-start: auto;
}
.panel-step,
.graph-panel h3 .panel-step {
  display: inline-grid;
  place-items: center;
  background: #edf3ff;
  border: 1px solid #e1eafb;
  color: #2457d6;
  width: 27px;
  height: 27px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  flex-shrink: 0;
  margin-inline-end: 4px;
}
.panel-hint {
  font-size: 11px;
  line-height: 1.9;
  margin: 0;
}
.equation-kind {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.equation-kind button {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border: 1px solid #dce3ed;
  border-radius: 16px;
  padding: 14px 8px;
  color: #62738b;
  background: white;
  transition:
    border-color 180ms,
    background-color 180ms,
    color 180ms;
}
.equation-kind button[aria-pressed="true"] {
  color: #2457d6;
  border-color: #2457d6;
  background: #f0f5ff;
}
.kind-formula {
  font-family: Georgia, serif;
  font-size: 28px;
  line-height: 1;
  font-style: italic;
  margin-bottom: 6px;
}
.equation-kind strong {
  font-size: 12px;
  font-weight: 600;
}
.equation-kind small {
  font-size: 10px;
  opacity: 0.8;
}
.coefficient-row {
  gap: 10px;
}
.coefficient-row input {
  min-height: 48px;
  border-radius: 12px;
  background: #fbfcfe !important;
  font-size: 18px !important;
}
.graph-toggles {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin: 0;
}
.graph-toggles .check-label {
  flex-direction: row-reverse;
  justify-content: space-between;
  min-height: 48px;
  border-bottom: 1px solid #edf1f6;
  font-size: 12px;
  color: #344b65;
}
.graph-toggles .check-label:last-child {
  border-bottom: 0;
}
.graph-toggles input {
  appearance: none;
  position: relative;
  width: 34px;
  height: 20px;
  border: 1px solid #c7d1e0;
  background: #dce3ed;
  border-radius: 20px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition:
    background-color 180ms,
    border-color 180ms;
}
.graph-toggles input::after {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  box-shadow: 0 1px 3px #172b4920;
  transition: transform 180ms;
}
.graph-toggles input:checked {
  border-color: #2457d6;
  background: #2457d6;
}
.graph-toggles input:checked::after {
  transform: translateX(14px);
}
.graph-toggles input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.point-list {
  max-height: 350px;
  padding: 0;
}
.point-list li {
  border: 1px solid #e1e8f1;
  border-radius: 14px;
  padding: 12px;
  background: #fafbfd;
  gap: 8px;
  margin-bottom: 10px;
}
.point-options {
  padding-top: 8px;
  padding-bottom: 0;
  border-top: 1px solid #e8edf4;
  border-bottom: 0;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}
.empty-points {
  padding: 24px 12px;
  border-radius: 14px;
  background: #f9fbfe;
  font-size: 11px;
  line-height: 1.9;
}
.marker-colors {
  padding: 12px;
  background: #f8fafd;
  border: 1px solid #e6ecf5;
  border-radius: 14px;
  gap: 12px;
}
.graph-summary {
  border-radius: 14px;
  background: #f8fafd;
  border-color: #e8edf5;
}
.preview-actions button {
  min-height: 40px;
  border-radius: 12px;
  font-size: 11px;
}
.preview-hint {
  line-height: 1.9;
  align-items: flex-start;
}
.preview-hint svg {
  flex-shrink: 0;
  margin-top: 3px;
}
.numeric-switch {
  border-radius: 12px;
}
.numeric-switch button {
  min-height: 32px;
  border-radius: 9px;
}
.graph-footer {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin: 24px -28px -28px;
  padding: 16px 28px;
  border-top: 1px solid #dce3ed;
  background: white;
  border-radius: 0 0 24px 24px;
}
.graph-footer button {
  min-height: 44px;
  border-radius: 12px;
}
.graph-save {
  padding-inline: 24px;
  box-shadow: 0 3px 8px #2457d61a;
}
@media (max-width: 650px) {
  .parabola-dialog {
    padding: 16px;
  }
  .parabola-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .graph-stage {
    grid-column: 1;
    grid-row: 1;
    position: static;
    padding: 14px;
  }
  .parabola-controls {
    grid-column: 1;
    grid-row: 2;
  }
  .graph-panel {
    padding: 16px;
  }
  .graph-header h2 {
    font-size: 16px;
  }
  .graph-header-icon {
    width: 42px;
    height: 42px;
    border-radius: 14px;
  }
  .graph-footer {
    margin: 20px -16px -16px;
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .graph-footer .graph-save {
    flex: 1;
    padding-inline: 14px;
  }
  .graph-footer .restore-button {
    font-size: 10px;
    padding-inline: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .equation-kind button,
  .graph-toggles input,
  .graph-toggles input::after {
    transition: none;
  }
}
</style>
