import { Capacitor, registerPlugin } from "@capacitor/core";
export const native = Capacitor.isNativePlatform();
export const SecureSession = registerPlugin("SecureSession");
export const BazaarBilling = registerPlugin("BazaarBilling");
const base = native
  ? import.meta.env.VITE_API_URL || "https://azmounbarg.ir"
  : "";
let token;
export async function setSession(value) {
  if (!native) return;
  if (value) await SecureSession.set({ token: value });
  else await SecureSession.clear();
  token = value || null;
}
export async function api(url, options = {}) {
  if (!url.startsWith("/") || url.startsWith("//"))
    throw new Error("Invalid API path");
  if (native && token === undefined)
    token = (await SecureSession.get()).token || null;
  const { blob = false, ...request } = options;
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (
    native &&
    token &&
    ![
      "/mobile/auth/challenge",
      "/mobile/auth/verify",
      "/auth/methods",
      "/plans",
      "/billing/capabilities",
      "/billing/bazaar/products",
    ].includes(url)
  )
    headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(base + "/api" + url, {
    credentials: native ? "omit" : "same-origin",
    signal: AbortSignal.timeout(
      url.endsWith("/pdf") || url === "/ai/generate" ? 90000 : 30000,
    ),
    ...request,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (
      response.status === 401 &&
      !url.startsWith("/auth/") &&
      !url.startsWith("/mobile/auth/")
    )
      window.dispatchEvent(new CustomEvent("session-expired"));
    throw Object.assign(
      new Error(data?.error || "ارتباط برقرار نشد. دوباره تلاش کنید."),
      { status: response.status, code: data?.code },
    );
  }
  return blob ||
    response.headers.get("content-type")?.includes("application/pdf")
    ? response.blob()
    : response.json();
}
