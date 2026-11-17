import { questionRichBodies } from "@exam/shared/exam.js";
import { api } from "./store.js";

export async function uploadImage(file, user) {
  if (
    !file ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error(
      "تصویر PNG، JPEG یا WebP با حجم کمتر از ۵ مگابایت انتخاب کنید.",
    );
  if (user && navigator.onLine) {
    const form = new FormData();
    form.append("image", file);
    return (await api("/assets", { method: "POST", body: form })).src;
  }
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / image.width, 1600 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.65, 0.5, 0.35]) {
      const result = canvas.toDataURL("image/webp", quality);
      if (result.startsWith("data:image/webp;") && result.length < 500000)
        return result;
    }
    throw new Error(
      "تصویر برای ذخیره مهمان بزرگ است. تصویر کوچک‌تری انتخاب کنید.",
    );
  } finally {
    image.close();
  }
}

export async function materializeAccountImages(document) {
  const sources = new Map();
  const collect = (node) => {
    if (node?.type === "image" && node.attrs?.src?.startsWith("data:"))
      sources.set(node.attrs.src, "");
    node.content?.forEach(collect);
  };
  document.questions.forEach((question) => {
    questionRichBodies(question).forEach(collect);
    for (const side of ["left", "right"])
      question.matching?.[side].forEach((item) => collect(item.body));
  });
  if (document.meta.logo?.startsWith("data:"))
    sources.set(document.meta.logo, "");
  for (const source of sources.keys()) {
    const blob = await (await fetch(source)).blob();
    sources.set(
      source,
      await uploadImage(
        new File([blob], "image.webp", { type: "image/webp" }),
        true,
      ),
    );
  }
  const replace = (node) => {
    if (node?.type === "image" && sources.has(node.attrs?.src))
      node.attrs.src = sources.get(node.attrs.src);
    node.content?.forEach(replace);
  };
  document.questions.forEach((question) => {
    questionRichBodies(question).forEach(replace);
    for (const side of ["left", "right"])
      question.matching?.[side].forEach((item) => replace(item.body));
  });
  if (sources.has(document.meta.logo))
    document.meta.logo = sources.get(document.meta.logo);
  return document;
}
