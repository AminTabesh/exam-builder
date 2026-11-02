<script setup>
import {
  mdiFileDocumentOutline,
  mdiPlus,
  mdiViewDashboardOutline,
  mdiCogOutline,
  mdiArrowLeft,
  mdiArrowRight,
  mdiCheck,
  mdiMagnify,
  mdiDotsHorizontal,
  mdiContentCopy,
  mdiTrashCanOutline,
  mdiDownload,
  mdiEyeOutline,
  mdiClose,
  mdiDrag,
  mdiChevronUp,
  mdiChevronDown,
  mdiFormatListBulleted,
  mdiTextBoxOutline,
  mdiMinus,
  mdiSchoolOutline,
  mdiAccountOutline,
  mdiLogout,
  mdiBookOpenPageVariantOutline,
  mdiCloudCheckOutline,
  mdiImageOutline,
  mdiFunctionVariant,
  mdiFormatBold,
  mdiFormatItalic,
  mdiHelpCircleOutline,
} from "@mdi/js";
defineProps({ name: String, size: { default: 22 } });
const icons = {
  file: mdiFileDocumentOutline,
  plus: mdiPlus,
  dashboard: mdiViewDashboardOutline,
  settings: mdiCogOutline,
  left: mdiArrowLeft,
  right: mdiArrowRight,
  check: mdiCheck,
  search: mdiMagnify,
  more: mdiDotsHorizontal,
  copy: mdiContentCopy,
  trash: mdiTrashCanOutline,
  download: mdiDownload,
  eye: mdiEyeOutline,
  close: mdiClose,
  drag: mdiDrag,
  up: mdiChevronUp,
  down: mdiChevronDown,
  mcq: mdiFormatListBulleted,
  written: mdiTextBoxOutline,
  blank: mdiMinus,
  school: mdiSchoolOutline,
  account: mdiAccountOutline,
  logout: mdiLogout,
  book: mdiBookOpenPageVariantOutline,
  saved: mdiCloudCheckOutline,
  image: mdiImageOutline,
  formula: mdiFunctionVariant,
  bold: mdiFormatBold,
  italic: mdiFormatItalic,
  help: mdiHelpCircleOutline,
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path :d="icons[name] || icons.file" />
  </svg>
</template>
