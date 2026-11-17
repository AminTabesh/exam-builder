import base from "./playwright.config.js";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  ...base,
  testDir: "tests/pwa",
  workers: 1,
  projects: [
    {
      name: "production-offline",
      use: { ...devices["Pixel 7"], serviceWorkers: "allow" },
    },
  ],
  webServer: [
    base.webServer[0],
    {
      command: "npm run start:frontend",
      url: "http://localhost:5183",
      reuseExistingServer: false,
      env: { FRONTEND_PORT: "5183", API_INTERNAL_URL: "http://127.0.0.1:3101" },
      timeout: 60000,
    },
  ],
});
