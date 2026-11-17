import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Browser } from "@capacitor/browser";
import { Keyboard } from "@capacitor/keyboard";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { native } from "./api.js";
const NativeFiles = registerPlugin("NativeFiles");
export async function savePdf(blob, filename, share = false) {
  if (!blob) throw new Error("ابتدا PDF را آماده کنید.");
  filename = filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 150);
  if (!native) {
    if (
      share &&
      navigator.canShare?.({
        files: [new File([blob], filename, { type: "application/pdf" })],
      })
    ) {
      await navigator.share({
        files: [new File([blob], filename, { type: "application/pdf" })],
      });
      return;
    }
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
  if (!share) {
    await NativeFiles.savePdf({ data: base64, filename });
    return;
  }
  const path = `exports/${Date.now()}-${filename}`;
  const { uri } = await Filesystem.writeFile({
    path,
    directory: Directory.Cache,
    data: base64,
    recursive: true,
  });
  try {
    await Share.share({ title: filename, files: [uri] });
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(
      () => {},
    );
  }
}
export async function initializeNative(router, store) {
  if (!native) return;
  document.documentElement.classList.add("native-app");
  let keyboard = false;
  await Keyboard.addListener("keyboardDidShow", () => {
    keyboard = true;
    document.documentElement.classList.add("keyboard-open");
  });
  await Keyboard.addListener("keyboardDidHide", () => {
    keyboard = false;
    document.documentElement.classList.remove("keyboard-open");
  });
  await App.addListener("backButton", () => {
    if (keyboard) {
      Keyboard.hide();
      return;
    }
    const overlay = document.querySelector(
      ".v-overlay--active .v-overlay__content",
    );
    if (overlay) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          keyCode: 27,
          bubbles: true,
        }),
      );
      return;
    }
    if (router.currentRoute.value.path.startsWith("/exam/")) {
      router.push("/dashboard");
      return;
    }
    if (router.currentRoute.value.path !== "/dashboard" && store.user) {
      router.push("/dashboard");
      return;
    }
    if (router.currentRoute.value.path !== "/account" && !store.user) {
      router.push("/account");
      return;
    }
    App.minimizeApp();
  });
  await App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) window.dispatchEvent(new CustomEvent("app-background"));
    else window.dispatchEvent(new CustomEvent("app-foreground"));
  });
  await Network.addListener("networkStatusChange", ({ connected }) =>
    window.dispatchEvent(new Event(connected ? "online" : "offline")),
  );
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (
      !anchor ||
      !/^https?:/.test(anchor.href) ||
      new URL(anchor.href).origin === location.origin
    )
      return;
    event.preventDefault();
    Browser.open({ url: anchor.href });
  });
}
