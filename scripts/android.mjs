import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const task = process.argv[2] || "sync";
if (!["sync", "debug", "release"].includes(task))
  throw new Error("Use sync, debug or release");
// Resolve native tools before spending time building the web application.
if (task !== "sync") {
  const systemJava =
    process.platform === "darwin"
      ? spawnSync("/usr/libexec/java_home", ["-v", "21"], { encoding: "utf8" })
      : null;
  const candidates = [
    process.env.JAVA_HOME,
    process.platform === "darwin" &&
      "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
    process.platform === "darwin" &&
      "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
    systemJava?.status === 0 && systemJava.stdout.trim(),
  ].filter(Boolean);
  let java;
  for (const home of candidates) {
    const check = spawnSync(home + "/bin/java", ["-version"], {
      encoding: "utf8",
    });
    const major = ((check.stderr || "") + (check.stdout || "")).match(/version "(\d+)/)?.[1];
    if (check.status === 0 && Number(major) >= 21) {
      java = home;
      break;
    }
  }
  if (!java)
    throw new Error(
      "JDK 21+ is required. Set JAVA_HOME to its installation directory.",
    );
  process.env.JAVA_HOME = java;
  console.log(`Using Java: ${java}`);
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    const sdk = [
      "/opt/homebrew/share/android-commandlinetools",
      process.env.HOME && process.env.HOME + "/Library/Android/sdk",
    ].find((path) => path && existsSync(path + "/platforms/android-36"));
    if (sdk) process.env.ANDROID_HOME = sdk;
  }
}
if (task === "release") {
  for (const name of [
    "VITE_API_URL",
    "VITE_SUPPORT_EMAIL",
    "ANDROID_KEYSTORE",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
    "ANDROID_VERSION_CODE",
    "ANDROID_VERSION_NAME",
  ]) {
    if (!process.env[name]) throw new Error(`Release requires ${name}`);
  }
  if (!/^https:\/\//.test(process.env.VITE_API_URL))
    throw new Error("API must use HTTPS");
  const placeholder = root + "docs/android/font-license-evidence.txt";
  const configuredEvidence = process.env.ANDROID_FONT_LICENSE_EVIDENCE;
  const evidence =
    configuredEvidence && existsSync(configuredEvidence)
      ? configuredEvidence
      : placeholder;
  if (!existsSync(evidence))
    throw new Error(`Font evidence placeholder not found: ${placeholder}`);
  if (evidence === placeholder)
    console.warn(
      "Using the temporary font-evidence placeholder. Font permissions remain unverified.",
    );
}
function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
run("npm", ["run", "build"]);
run("npx", ["cap", "sync", "android"], root + "apps/frontend");
if (task !== "sync") {
  run(
    "./gradlew",
    task === "release"
      ? ["assembleRelease", "bundleRelease"]
      : ["assembleDebug"],
    root + "apps/frontend/android",
  );
  const output = root + "android-release";
  mkdirSync(output, { recursive: true });
  if (task === "release") {
    copyFileSync(
      root +
        "apps/frontend/android/app/build/outputs/apk/release/app-release.apk",
      output + "/azmounbarg-release.apk",
    );
    copyFileSync(
      root +
        "apps/frontend/android/app/build/outputs/bundle/release/app-release.aab",
      output + "/azmounbarg-release.aab",
    );
  } else
    copyFileSync(
      root + "apps/frontend/android/app/build/outputs/apk/debug/app-debug.apk",
      output + "/azmounbarg-debug.apk",
    );
}

if (task !== "sync")
  console.log(`APK created: ${root}android-release/azmounbarg-${task}.apk`);
