<script setup>
import { ref, computed, h, onMounted, onBeforeUnmount } from "vue";
import {
  shapeKinds,
  shapeLabels,
  emptyDrawing,
  createShape,
  drawingPreset,
  drawingSchema,
  shapeGraphic,
} from "@exam/shared/drawing.js";
import { useElementSize } from "@vueuse/core";
const props = defineProps({ modelValue: Object });
const emit = defineEmits(["save", "cancel"]);
const drawing = ref(
    JSON.parse(JSON.stringify(props.modelValue || emptyDrawing())),
  ),
  selected = ref(null),
  snap = ref(true),
  error = ref("");
const history = ref([]),
  future = ref([]),
  svg = ref(null);
const { width: canvasWidth } = useElementSize(svg);
const handleScale = computed(
  () => drawing.value.width / (canvasWidth.value || drawing.value.width),
);
const current = computed(() =>
  drawing.value.shapes.find((shape) => shape.id === selected.value),
);
const clone = (value) => JSON.parse(JSON.stringify(value));
function checkpoint() {
  history.value.push(clone(drawing.value));
  if (history.value.length > 100) history.value.shift();
  future.value = [];
}
function undo() {
  if (!history.value.length) return;
  future.value.push(clone(drawing.value));
  drawing.value = history.value.pop();
}
function redo() {
  if (!future.value.length) return;
  history.value.push(clone(drawing.value));
  drawing.value = future.value.pop();
}
function add(kind) {
  if (drawing.value.shapes.length >= 100) {
    error.value = "حداکثر صد شکل مجاز است.";
    return;
  }
  checkpoint();
  const shape = createShape(kind, crypto.randomUUID());
  drawing.value.shapes.push(shape);
  selected.value = shape.id;
}
function preset(name) {
  checkpoint();
  drawing.value = drawingPreset(name, () => crypto.randomUUID());
  selected.value = null;
}
function remove() {
  if (!current.value) return;
  checkpoint();
  drawing.value.shapes = drawing.value.shapes.filter(
    (shape) => shape.id !== selected.value,
  );
  selected.value = null;
}
function duplicate() {
  if (!current.value || drawing.value.shapes.length >= 100) return;
  checkpoint();
  const shape = {
    ...current.value,
    id: crypto.randomUUID(),
    x: Math.min(600, current.value.x + 20),
    y: Math.min(550, current.value.y + 20),
  };
  drawing.value.shapes.push(shape);
  selected.value = shape.id;
}
function update(key, value) {
  if (!current.value) return;
  checkpoint();
  current.value[key] = value;
}
let drag;
function cancelGesture(event) {
  if (drag && event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    finish(null, true);
  }
}
onMounted(() => window.addEventListener("keydown", cancelGesture, true));
onBeforeUnmount(() =>
  window.removeEventListener("keydown", cancelGesture, true),
);
const corners = ["nw", "ne", "sw", "se"];
function resizeDown(event, corner) {
  if (event.button !== 0 || drag || !current.value) return;
  event.stopPropagation();
  event.preventDefault();
  drag = {
    kind: "resize",
    pointer: event.pointerId,
    id: current.value.id,
    corner,
    start: point(event),
    shape: clone(current.value),
    before: clone(drawing.value),
  };
  svg.value.setPointerCapture(event.pointerId);
}
function finish(event, cancel = false) {
  if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointer))
    return;
  const gesture = drag;
  drag = null;
  if (gesture.kind === "resize") {
    if (cancel)
      Object.assign(
        drawing.value.shapes.find((s) => s.id === gesture.id),
        gesture.shape,
      );
    else if (JSON.stringify(gesture.before) !== JSON.stringify(drawing.value)) {
      history.value.push(gesture.before);
      if (history.value.length > 100) history.value.shift();
      future.value = [];
    }
  }
  if (svg.value.hasPointerCapture(gesture.pointer))
    svg.value.releasePointerCapture(gesture.pointer);
}
function point(event) {
  const p = svg.value.createSVGPoint();
  p.x = event.clientX;
  p.y = event.clientY;
  return p.matrixTransform(svg.value.getScreenCTM().inverse());
}
function down(event, shape) {
  if (event.button !== 0) return;
  selected.value = shape.id;
  checkpoint();
  const p = point(event);
  drag = {
    pointer: event.pointerId,
    id: shape.id,
    x: p.x - shape.x,
    y: p.y - shape.y,
  };
  svg.value.setPointerCapture(event.pointerId);
  event.preventDefault();
}
function move(event) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const shape = drawing.value.shapes.find((s) => s.id === drag.id);
  if (!shape) return;
  const p = point(event),
    grid = snap.value ? 10 : 1;
  if (drag.kind === "resize") {
    const original = drag.shape,
      angle = (original.rotation * Math.PI) / 180;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const dx = p.x - drag.start.x,
      dy = p.y - drag.start.y;
    const localX = dx * cos + dy * sin,
      localY = -dx * sin + dy * cos;
    const west = drag.corner.includes("w"),
      north = drag.corner.includes("n");
    shape.width = Math.max(
      10,
      Math.min(
        650,
        Math.round((original.width + (west ? -localX : localX)) / grid) * grid,
      ),
    );
    shape.height = Math.max(
      10,
      Math.min(
        600,
        Math.round((original.height + (north ? -localY : localY)) / grid) *
          grid,
      ),
    );
    const shiftX = west ? original.width - shape.width : 0,
      shiftY = north ? original.height - shape.height : 0;
    shape.x = Math.max(
      0,
      Math.min(650, original.x + shiftX * cos - shiftY * sin),
    );
    shape.y = Math.max(
      0,
      Math.min(600, original.y + shiftX * sin + shiftY * cos),
    );
    return;
  }
  shape.x = Math.max(
    0,
    Math.min(
      drawing.value.width - 10,
      Math.round((p.x - drag.x) / grid) * grid,
    ),
  );
  shape.y = Math.max(
    0,
    Math.min(
      drawing.value.height - 10,
      Math.round((p.y - drag.y) / grid) * grid,
    ),
  );
}
function keys(event) {
  if (event.key === "Escape" && drag) {
    event.preventDefault();
    event.stopPropagation();
    finish(null, true);
    return;
  }
  if (event.target.matches("input,textarea,select")) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if (!current.value) return;
  if (["Delete", "Backspace"].includes(event.key)) {
    event.preventDefault();
    remove();
  }
  const delta = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[event.key];
  if (delta) {
    event.preventDefault();
    checkpoint();
    const step = event.shiftKey ? 10 : 1;
    current.value.x = Math.max(
      0,
      Math.min(drawing.value.width - 10, current.value.x + delta[0] * step),
    );
    current.value.y = Math.max(
      0,
      Math.min(drawing.value.height - 10, current.value.y + delta[1] * step),
    );
  }
}
function save() {
  const parsed = drawingSchema.safeParse(drawing.value);
  if (!parsed.success || !drawing.value.shapes.length) {
    error.value = "شکل معتبر با حداقل یک جزء بسازید. اندازه‌ها را بررسی کنید.";
    return;
  }
  emit("save", parsed.data);
}
const ShapeView = (props) => h("g", {}, shapeGraphic(props.shape));
</script>
<template>
  <section class="drawing-editor" @keydown="keys">
    <h2>طراحی شکل و بردار</h2>
    <p class="field-hint">
      برای جابه‌جایی، جزء را بکشید. برای تغییر اندازه، جزء را انتخاب و گوشه‌های
      کادر آن را بکشید. اندازه و چرخش از بخش مشخصات هم قابل تنظیم است.
    </p>
    <div class="drawing-toolbar">
      <v-btn
        v-for="kind in shapeKinds"
        :key="kind"
        size="small"
        variant="outlined"
        @click="add(kind)"
        >{{ shapeLabels[kind] }}</v-btn
      >
    </div>
    <div class="drawing-toolbar">
      <v-btn size="small" @click="preset('force')">نمودار نیرو</v-btn
      ><v-btn size="small" @click="preset('incline')">سطح شیب‌دار</v-btn
      ><v-btn size="small" @click="preset('circuit')">مدار ساده</v-btn
      ><v-btn size="small" :disabled="!history.length" @click="undo"
        >واگرد</v-btn
      ><v-btn size="small" :disabled="!future.length" @click="redo"
        >بازانجام</v-btn
      ><v-checkbox v-model="drawing.grid" label="شبکه" /><v-checkbox
        v-model="snap"
        label="چسبیدن به شبکه"
      />
    </div>
    <v-alert v-if="error" type="error">{{ error }}</v-alert>
    <div class="drawing-workspace">
      <svg
        ref="svg"
        class="drawing-canvas"
        :viewBox="`0 0 ${drawing.width} ${drawing.height}`"
        :width="drawing.width"
        :height="drawing.height"
        role="group"
        aria-label="بوم طراحی؛ جهت مختصات از چپ به راست"
        tabindex="0"
        dir="ltr"
        @pointermove="move"
        @pointerup="finish"
        @pointercancel="finish($event, true)"
        @lostpointercapture="finish($event, true)"
      >
        <defs>
          <pattern
            id="editor-grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0 H0 V20"
              fill="none"
              stroke="#dce3e8"
              stroke-width="0.7"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          :fill="drawing.grid ? 'url(#editor-grid)' : 'white'"
          @pointerdown="selected = null"
        />
        <g
          v-for="shape in drawing.shapes"
          :key="shape.id"
          :transform="`translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`"
          :stroke="shape.stroke"
          stroke-width="2"
          fill="none"
          role="button"
          tabindex="0"
          :aria-label="`${shapeLabels[shape.kind]} ${shape.label}`"
          :aria-pressed="selected === shape.id"
          @focus="selected = shape.id"
          @pointerdown="down($event, shape)"
        >
          <rect
            x="-8"
            y="-24"
            :width="shape.width + 16"
            :height="shape.height + 32"
            :stroke="selected === shape.id ? '#688caf' : 'transparent'"
            stroke-dasharray="4 3"
            fill="transparent"
          />
          <ShapeView :shape="shape" />
        </g>
        <g
          v-if="current"
          class="shape-resize-controls"
          :transform="`translate(${current.x} ${current.y}) rotate(${current.rotation})`"
        >
          <rect
            x="-8"
            y="-24"
            :width="current.width + 16"
            :height="current.height + 32"
            fill="none"
            stroke="#2457d6"
            stroke-dasharray="4 3"
            vector-effect="non-scaling-stroke"
            pointer-events="none"
          />
          <g
            v-for="corner in corners"
            :key="corner"
            :data-resize-corner="corner"
            :transform="`translate(${corner.includes('w') ? -8 : current.width + 8} ${corner.includes('n') ? -24 : current.height + 8}) scale(${handleScale})`"
            class="shape-resize-handle"
            role="img"
            aria-label="گوشه تغییر اندازه؛ بکشید"
            @pointerdown="resizeDown($event, corner)"
          >
            <rect x="-18" y="-18" width="36" height="36" fill="transparent" />
            <rect
              x="-6"
              y="-6"
              width="12"
              height="12"
              rx="2"
              fill="white"
              stroke="#2457d6"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </g>
      </svg>
      <div class="drawing-inspector">
        <v-text-field
          v-model="drawing.label"
          label="توضیح شکل"
          maxlength="200"
        />
        <v-text-field
          v-model.number="drawing.height"
          label="ارتفاع بوم"
          type="number"
          min="100"
          max="600"
        />
        <template v-if="current">
          <v-text-field
            :model-value="current.label"
            @update:model-value="update('label', $event)"
            label="برچسب"
            maxlength="120"
          />
          <v-text-field
            v-for="(label, key) in {
              x: 'مکان افقی',
              y: 'مکان عمودی',
              width: 'عرض',
              height: 'ارتفاع',
              rotation: 'چرخش (درجه)',
            }"
            :key="key"
            :model-value="current[key]"
            @update:model-value="update(key, Number($event))"
            :label="label"
            type="number"
          />
          <v-select
            :model-value="current.stroke"
            @update:model-value="update('stroke', $event)"
            :items="[
              { title: 'سرمه‌ای', value: '#172f43' },
              { title: 'مشکی', value: '#000000' },
              { title: 'قرمز', value: '#a43232' },
              { title: 'سبز', value: '#32735c' },
            ]"
            label="رنگ"
          />
          <v-btn @click="duplicate">تکثیر جزء</v-btn
          ><v-btn color="error" @click="remove">حذف جزء</v-btn>
        </template>
      </div>
    </div>
    <div class="drawing-toolbar">
      <v-btn color="primary" @click="save">درج / ذخیره شکل</v-btn
      ><v-btn @click="emit('cancel')">انصراف</v-btn>
    </div>
  </section>
</template>

<style scoped>
.shape-resize-handle {
  cursor: nwse-resize;
  touch-action: none;
}
.shape-resize-handle[data-resize-corner="ne"],
.shape-resize-handle[data-resize-corner="sw"] {
  cursor: nesw-resize;
}
.drawing-canvas {
  touch-action: none;
}
</style>
