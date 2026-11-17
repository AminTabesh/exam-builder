import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// macOS protects Firefox's shared app-data directory even with a temporary
// -profile. Isolate the test app-data root without touching personal profiles.
// https://github.com/microsoft/playwright/issues/42768
const firefoxHome =
  process.platform === "darwin"
    ? join(tmpdir(), "exam-playwright-firefox-appdata")
    : null;
// Let macOS manage this temporary app-data root. Traversing its protected
// synthetic Downloads directory during process exit can block worker shutdown.
if (firefoxHome) mkdirSync(firefoxHome, { recursive: true });
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:5183",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node scripts/e2e-server.js",
      url: "http://127.0.0.1:3101/api/health",
      reuseExistingServer: !!process.env.PW_REUSE_SERVER,
      timeout: 90000,
    },
    {
      command: "npm run dev:frontend",
      url: "http://localhost:5183",
      reuseExistingServer: !!process.env.PW_REUSE_SERVER,
      env: { FRONTEND_PORT: "5183", API_INTERNAL_URL: "http://127.0.0.1:3101" },
      timeout: 60000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: firefoxHome
          ? { env: { ...process.env, CFFIXED_USER_HOME: firefoxHome } }
          : {},
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
