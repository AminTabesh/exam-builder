<script setup>
import { computed } from "vue";
import { mathSegments } from "@exam/shared/math.js";
import RichEditor from "./RichEditor.vue";
const props = defineProps({
  modelValue: [String, Object],
  label: String,
  errorMessages: [String, Array],
});
const emit = defineEmits(["update:modelValue"]);
const document = computed(() =>
  typeof props.modelValue === "string"
    ? {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: mathSegments(props.modelValue).flatMap((part) =>
              part.latex !== undefined
                ? [{ type: "formula", attrs: { latex: part.latex } }]
                : part.text
                  ? [{ type: "text", text: part.text }]
                  : [],
            ),
          },
        ],
      }
    : props.modelValue,
);
</script>
<template>
  <div class="option-rich-editor">
    <RichEditor
      :model-value="document"
      :label="label"
      :allow-blank="false"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="errorMessages?.length" class="field-error" role="alert">
      {{
        Array.isArray(errorMessages) ? errorMessages.join(" ") : errorMessages
      }}
    </p>
  </div>
</template>
<style scoped>
.option-rich-editor {
  min-width: 0;
  width: 100%;
}
.option-rich-editor :deep(.tiptap) {
  min-height: 90px;
}
</style>
