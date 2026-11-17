<script setup>
import { useMediaQuery } from "@vueuse/core";
const phoneEditor = useMediaQuery("(max-width: 767px)");
import { defaultParabola } from "@exam/shared/parabola.js";
import ParabolaDialog from "./ParabolaDialog.vue";
import { visualNodeView } from "../visualNodeView.js";
import { ref, watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import { renderFormula } from "@exam/shared/math.js";
import AppSlider from "../../../components/AppSlider.vue";
import Icon from "../../../components/Icon.vue";
import FormulaDialog from "./FormulaDialog.vue";
import DrawingEditor from "./DrawingEditor.vue";
import { emptyDrawing } from "@exam/shared/drawing.js";
import { useExams } from "../store.js";
import { uploadImage } from "../imageUpload.js";
const props = defineProps({
  modelValue: Object,
  label: { default: "متن سؤال" },
  allowBlank: Boolean,
  compact: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const store = useExams(),
  formula = ref(false),
  latex = ref(""),
  error = ref(""),
  advanced = ref(false),
  width = ref(90),
  imageWidth = ref(240),
  uploading = ref(false),
  fileInput = ref(null);
const imageAlt = ref(""),
  imageAlign = ref("start");
const drawingDialog = ref(false),
  drawingValue = ref(null);
let drawingRange;
function openDrawing() {
  drawingRange = {
    from: editor.value.state.selection.from,
    to: editor.value.state.selection.to,
  };
  drawingValue.value = editor.value?.isActive("drawing")
    ? editor.value.getAttributes("drawing").drawing
    : emptyDrawing();
  drawingDialog.value = true;
}
function saveDrawing(drawing) {
  const attrs = editor.value.isActive("drawing")
    ? editor.value.getAttributes("drawing")
    : { wrap: "left" };
  editor.value
    .chain()
    .focus()
    .insertContentAt(drawingRange, {
      type: "drawing",
      attrs: { ...attrs, drawing },
    })
    .run();
  drawingDialog.value = false;
}

const TextLayout = Extension.create({
  name: "textLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: "start",
            parseHTML: (element) => element.style.textAlign || "start",
            renderHTML: (attrs) => ({ style: `text-align:${attrs.textAlign}` }),
          },
          dir: {
            default: "auto",
            parseHTML: (element) => element.getAttribute("dir") || "auto",
            renderHTML: (attrs) => ({ dir: attrs.dir }),
          },
        },
      },
    ];
  },
});
const Formula = Node.create({
  name: "formula",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-formula]" }];
  },
  renderHTML({ node }) {
    return [
      "span",
      { "data-formula": node.attrs.latex, dir: "ltr", class: "formula" },
      node.attrs.latex,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "formula";
      dom.dir = "ltr";
      try {
        dom.innerHTML = renderFormula(node.attrs.latex);
      } catch {
        dom.textContent = node.attrs.latex;
      }
      return { dom };
    };
  },
});
const parabolaDialog = ref(false),
  parabolaValue = ref(null);
let visualRange;
function openParabola() {
  const ed = editor.value;
  visualRange = { from: ed.state.selection.from, to: ed.state.selection.to };
  parabolaValue.value = ed.isActive("parabola")
    ? JSON.parse(JSON.stringify(ed.getAttributes("parabola").parabola))
    : defaultParabola();
  parabolaDialog.value = true;
}
function saveParabola(value) {
  editor.value
    .chain()
    .focus()
    .insertContentAt(visualRange, {
      type: "parabola",
      attrs: {
        ...(editor.value.isActive("parabola")
          ? editor.value.getAttributes("parabola")
          : { wrap: "left" }),
        parabola: value,
      },
    })
    .run();
  parabolaDialog.value = false;
}
const editVisual = (type) =>
  type === "parabola" ? openParabola() : openDrawing();
const Parabola = Node.create({
  name: "parabola",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { parabola: { default: defaultParabola() } };
  },
  parseHTML() {
    return [{ tag: "div[data-parabola]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-parabola": "true" }),
      "سهمی",
    ];
  },
  addNodeView() {
    return visualNodeView(editVisual);
  },
});
const VisualLayout = Extension.create({
  name: "visualLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["image", "drawing", "parabola"],
        attributes: {
          width: { default: null },
          wrap: { default: "none" },
          imageAlign: { default: "start" },
        },
      },
    ];
  },
});
const Drawing = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { drawing: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-drawing]" }];
  },
  renderHTML() {
    return ["div", { "data-drawing": "true" }, "شکل سؤال"];
  },
  addNodeView() {
    return visualNodeView(editVisual);
  },
});
const Blank = Node.create({
  name: "blank",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { width: { default: 90 } };
  },
  parseHTML() {
    return [{ tag: "span[data-blank]" }];
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        "data-blank": "true",
        class: "inline-blank",
        style: `width:${node.attrs.width}px`,
      },
      "\u00a0",
    ];
  },
});
const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: { default: 240 },
      imageAlign: { default: "start" },
    };
  },
  addNodeView() {
    return visualNodeView(editVisual);
  },
  parseHTML() {
    return [{ tag: "img" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
        class: `image-align-${HTMLAttributes.imageAlign || "start"}`,
        style: `width:${HTMLAttributes.width}px;max-width:100%`,
      }),
    ];
  },
});
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: false,
      codeBlock: false,
      heading: { levels: [2, 3] },
    }),
    TextLayout,
    Formula,
    Drawing,
    Parabola,
    VisualLayout,
    Blank,
    Image,
  ],
  content: props.modelValue,
  editorProps: {
    attributes: {
      "aria-label": props.label,
      role: "textbox",
      "aria-multiline": "true",
      dir: "auto",
    },
  },
  onUpdate: ({ editor }) => emit("update:modelValue", editor.getJSON()),
  onSelectionUpdate: ({ editor }) => {
    if (editor.isActive("blank"))
      width.value = editor.getAttributes("blank").width || 90;
    if (editor.isActive("image")) {
      imageWidth.value = editor.getAttributes("image").width || 240;
      imageAlt.value = editor.getAttributes("image").alt || "";
      imageAlign.value = editor.getAttributes("image").imageAlign || "start";
    }
  },
});
watch(
  () => props.modelValue,
  (value) => {
    if (
      editor.value &&
      JSON.stringify(value) !== JSON.stringify(editor.value.getJSON())
    )
      editor.value.commands.setContent(value, { emitUpdate: false });
  },
  { deep: true },
);
let formulaRange;
function insertFormula(value) {
  editor.value
    .chain()
    .focus()
    .insertContentAt(formulaRange, { type: "formula", attrs: { latex: value } })
    .run();
  error.value = "";
}
function openFormula() {
  const { from, to } = editor.value.state.selection;
  formulaRange = { from, to };
  latex.value = editor.value.isActive("formula")
    ? editor.value.getAttributes("formula").latex || ""
    : "";
  formula.value = true;
}
function setBlockAttr(name, value) {
  const type = editor.value.isActive("heading") ? "heading" : "paragraph";
  editor.value
    .chain()
    .focus()
    .updateAttributes(type, { [name]: value })
    .run();
}
function updateImage(attrs) {
  if (editor.value?.isActive("image"))
    editor.value.chain().focus().updateAttributes("image", attrs).run();
}
async function upload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    const src = await uploadImage(file, store.user);
    if (editor.value.isActive("image")) updateImage({ src, alt: file.name });
    else
      editor.value
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src,
            width: Math.max(20, Math.min(650, Number(imageWidth.value) || 240)),
            alt: file.name,
          },
        })
        .run();
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
    event.target.value = "";
  }
}
onBeforeUnmount(() => editor.value?.destroy());
</script>
<template>
  <div class="rich-editor">
    <v-dialog :fullscreen="phoneEditor" v-model="parabolaDialog" max-width="900"
      ><v-card
        ><ParabolaDialog
          v-if="parabolaDialog"
          :initial="parabolaValue"
          @save="saveParabola"
          @cancel="parabolaDialog = false" /></v-card
    ></v-dialog>
    <v-dialog :fullscreen="phoneEditor" v-model="drawingDialog" max-width="1100"
      ><v-card
        ><v-card-text
          ><DrawingEditor
            v-if="drawingDialog"
            :model-value="drawingValue"
            @save="saveDrawing"
            @cancel="drawingDialog = false" /></v-card-text></v-card
    ></v-dialog>
    <div class="rich-label">{{ label }}</div>
    <EditorContent :editor="editor" />
    <div class="editor-tools" @mousedown.prevent>
      <button type="button" @click="openParabola">
        <Icon name="parabola" :size="18" />سهمی
      </button>
      <template v-for="type in ['image', 'drawing', 'parabola']" :key="type">
        <template v-if="editor?.isActive(type)">
          <AppSlider
            label="اندازه"
            :min="20"
            :max="650"
            unit="px"
            :model-value="editor.getAttributes(type).width || 400"
            @update:model-value="
              editor
                .chain()
                .focus()
                .updateAttributes(type, { width: $event })
                .run()
            "
          />
          <button
            v-for="side in ['none', 'right', 'left']"
            :key="side"
            type="button"
            @click="
              editor
                .chain()
                .focus()
                .updateAttributes(type, { wrap: side })
                .run()
            "
          >
            {{
              side === "none"
                ? "در متن"
                : side === "right"
                  ? "کنار متن راست"
                  : "کنار متن چپ"
            }}
          </button>
        </template>
      </template>
      <button type="button" @click="openFormula">
        <Icon name="formula" :size="18" /> فرمول</button
      ><button type="button" @click="openDrawing">
        <Icon name="written" :size="18" /> شکل</button
      ><button
        type="button"
        @click="editor.chain().focus().toggleBold().run()"
        :aria-pressed="editor?.isActive('bold')"
      >
        <Icon name="bold" :size="18" /><span class="sr-only">پررنگ</span>
      </button>
      <button
        type="button"
        @click="advanced = !advanced"
        :aria-expanded="advanced"
      >
        <Icon name="settings" :size="16" /> ابزارهای بیشتر</button
      ><button
        v-if="allowBlank"
        type="button"
        @click="
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'blank',
              attrs: {
                width: Math.max(20, Math.min(650, Number(width) || 90)),
              },
            })
            .run()
        "
      >
        ＋ درج جای خالی
      </button>
    </div>
    <div v-if="advanced" class="format-toolbar">
      <v-btn
        size="small"
        variant="text"
        aria-label="واگرد"
        @click="editor.chain().focus().undo().run()"
        >↶</v-btn
      >
      <v-btn
        size="small"
        variant="text"
        aria-label="بازانجام"
        @click="editor.chain().focus().redo().run()"
        >↷</v-btn
      >
      <v-btn
        size="small"
        variant="text"
        aria-label="پررنگ"
        @click="editor.chain().focus().toggleBold().run()"
        ><Icon name="bold" /></v-btn
      ><v-btn
        size="small"
        variant="text"
        aria-label="مورب"
        @click="editor.chain().focus().toggleItalic().run()"
        ><Icon name="italic" /></v-btn
      ><v-btn
        size="small"
        variant="text"
        aria-label="زیرخط"
        @click="editor.chain().focus().toggleUnderline().run()"
        >U̲</v-btn
      ><v-btn
        size="small"
        variant="text"
        aria-label="خط‌خورده"
        @click="editor.chain().focus().toggleStrike().run()"
        >S̶</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="editor.chain().focus().setParagraph().run()"
        >متن</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >تیتر</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="editor.chain().focus().toggleBulletList().run()"
        >فهرست •</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="editor.chain().focus().toggleOrderedList().run()"
        >فهرست ۱</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="setBlockAttr('textAlign', 'start')"
        >راست‌چین</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="setBlockAttr('textAlign', 'center')"
        >وسط‌چین</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="setBlockAttr('textAlign', 'end')"
        >چپ‌چین</v-btn
      ><v-btn size="small" variant="text" @click="setBlockAttr('dir', 'rtl')"
        >RTL</v-btn
      ><v-btn size="small" variant="text" @click="setBlockAttr('dir', 'ltr')"
        >LTR</v-btn
      ><v-btn
        size="small"
        variant="text"
        @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
        >پاک‌کردن قالب</v-btn
      ><v-btn size="small" variant="text" @click="openDrawing">{{
        editor?.isActive("drawing") ? "ویرایش شکل" : "شکل و بردار"
      }}</v-btn
      ><v-btn
        size="small"
        variant="text"
        :loading="uploading"
        @click="fileInput.click()"
        ><Icon name="image" :size="18" />
        {{ editor?.isActive("image") ? "جایگزینی تصویر" : "تصویر" }}</v-btn
      ><input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        @change="upload"
      /><label v-if="editor?.isActive('image')" class="compact-number"
        >عرض تصویر
        <input
          v-model="imageWidth"
          type="number"
          min="20"
          max="650"
          @change="
            updateImage({
              width: Math.max(20, Math.min(650, Number(imageWidth) || 240)),
            })
          "
        />
        px</label
      ><label v-if="editor?.isActive('image')" class="compact-number"
        >متن جایگزین
        <input
          v-model="imageAlt"
          type="text"
          maxlength="200"
          @change="updateImage({ alt: imageAlt })"
        />
      </label>
      <label v-if="editor?.isActive('image')" class="compact-number"
        >جای تصویر
        <select v-model="imageAlign" @change="updateImage({ imageAlign })">
          <option value="start">ابتدا</option>
          <option value="center">وسط</option>
          <option value="end">انتها</option>
        </select>
      </label>
      <v-btn
        v-if="editor?.isActive('image')"
        size="small"
        variant="text"
        @click="editor.chain().focus().deleteSelection().run()"
        >حذف تصویر</v-btn
      >
      <label v-if="allowBlank" class="compact-number"
        >عرض جای خالی
        <input
          v-model="width"
          type="number"
          min="20"
          max="650"
          @change="
            editor?.isActive('blank') &&
            editor
              .chain()
              .focus()
              .updateAttributes('blank', {
                width: Math.max(20, Math.min(650, Number(width) || 90)),
              })
              .run()
          "
      /></label>
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
  <FormulaDialog v-model="formula" :initial="latex" @save="insertFormula" />
</template>
