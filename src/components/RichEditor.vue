<script setup>
import { ref, watch, onBeforeUnmount, computed } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";
import Icon from "./Icon.vue";
import { api, useExams } from "../stores/exams";
const props = defineProps({
  modelValue: Object,
  label: { default: "متن سؤال" },
  allowBlank: Boolean,
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
      dom.innerHTML = katex.renderToString(node.attrs.latex, {
        throwOnError: false,
        trust: false,
      });
      return { dom };
    };
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
    };
  },
  parseHTML() {
    return [{ tag: "img" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, {
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
      heading: false,
      underline: false,
    }),
    Formula,
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
const preview = computed(() => {
  try {
    return katex.renderToString(latex.value, {
      throwOnError: true,
      trust: false,
      strict: "error",
    });
  } catch {
    return "";
  }
});
function insertFormula() {
  if (!preview.value || !latex.value) {
    error.value = "فرمول معتبر وارد کنید؛ برای نمونه x^2 + y^2.";
    return;
  }
  editor.value
    .chain()
    .focus()
    .insertContent({ type: "formula", attrs: { latex: latex.value } })
    .run();
  formula.value = false;
  latex.value = "";
  error.value = "";
}
async function upload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploading.value = true;
  try {
    const form = new FormData();
    form.append("image", file);
    const result = await api("/assets", { method: "POST", body: form });
    editor.value
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: result.src,
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
    <div class="rich-label">{{ label }}</div>
    <EditorContent :editor="editor" />
    <div class="editor-tools">
      <button
        type="button"
        @click="advanced = !advanced"
        :aria-expanded="advanced"
      >
        <Icon name="plus" :size="16" /> قالب‌بندی، تصویر و فرمول</button
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
        aria-label="پررنگ"
        @click="editor.chain().focus().toggleBold().run()"
        ><Icon name="bold" /></v-btn
      ><v-btn
        size="small"
        variant="text"
        aria-label="مورب"
        @click="editor.chain().focus().toggleItalic().run()"
        ><Icon name="italic" /></v-btn
      ><v-btn size="small" variant="text" @click="formula = true"
        ><Icon name="formula" :size="18" /> فرمول</v-btn
      ><v-btn
        size="small"
        variant="text"
        :disabled="!store.user"
        :loading="uploading"
        @click="fileInput.click()"
        ><Icon name="image" :size="18" /> تصویر</v-btn
      ><input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        @change="upload"
      /><label class="compact-number"
        >عرض تصویر
        <input
          v-model="imageWidth"
          type="number"
          min="20"
          max="650"
          @change="
            editor.isActive('image') &&
            editor
              .chain()
              .focus()
              .updateAttributes('image', {
                width: Math.max(20, Math.min(650, Number(imageWidth))),
              })
              .run()
          "
        />
        px</label
      ><label v-if="allowBlank" class="compact-number"
        >عرض جای خالی
        <input v-model="width" type="number" min="20" max="650" /></label
      ><small v-if="!store.user" class="muted"
        >برای افزودن تصویر، وارد حساب شوید.</small
      >
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
  <v-dialog v-model="formula"
    ><v-card title="افزودن فرمول"
      ><v-card-text
        ><p class="muted tw-mb-4">
          فرمول را با LaTeX بنویسید یا از نمادها کمک بگیرید.
        </p>
        <div class="symbol-buttons" dir="ltr">
          <v-btn
            v-for="symbol in [
              'x^2',
              '\\frac{a}{b}',
              '\\sqrt{x}',
              '\\pi',
              '\\sum_{i=1}^{n}',
              '\\alpha',
              '\\leq',
            ]"
            :key="symbol"
            variant="outlined"
            size="small"
            @click="latex += symbol"
            >{{ symbol }}</v-btn
          >
        </div>
        <v-text-field
          v-model="latex"
          label="فرمول LaTeX"
          dir="ltr"
          class="tw-mt-5"
          :error-messages="
            latex && !preview
              ? 'ساختار فرمول درست نیست. آکولادها را بررسی کنید.'
              : ''
          " />
        <div class="formula-preview" dir="ltr" v-html="preview" /></v-card-text
      ><v-card-actions
        ><v-btn
          color="primary"
          variant="flat"
          :disabled="!preview || !latex"
          @click="insertFormula"
          >درج فرمول</v-btn
        ><v-btn @click="formula = false">انصراف</v-btn></v-card-actions
      ></v-card
    ></v-dialog
  >
</template>
