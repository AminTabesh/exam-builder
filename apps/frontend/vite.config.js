import { defineConfig } from "vite";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  envDir: "../..",
  cacheDir:
    process.env.DOCKER_WATCH_POLLING === "true"
      ? "/tmp/exam-vite-cache"
      : undefined,
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "آزمون‌برگ",
        short_name: "آزمون‌برگ",
        lang: "fa",
        dir: "rtl",
        start_url: "/dashboard",
        display: "standalone",
        theme_color: "#102a56",
        background_color: "#f5f7fb",
        icons: [
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,ttf,svg,png}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
    {
      name: "math-assets",
      configureServer(server) {
        server.middlewares.use("/mathlive/fonts", (req, res, next) => {
          const file = resolve(
            "../../node_modules/mathlive/fonts",
            (req.url || "").split("?")[0].replace(/^\//, ""),
          );
          if (
            !file.startsWith(
              resolve("../../node_modules/mathlive/fonts") + "/",
            ) ||
            !existsSync(file)
          )
            return next();
          res.setHeader("Content-Type", "font/woff2");
          res.end(readFileSync(file));
        });
      },
      closeBundle() {
        cpSync("../../node_modules/mathlive/fonts", "dist/mathlive/fonts", {
          recursive: true,
        });
      },
    },
  ],
  server: {
    allowedHosts: ["azmounbarg.ir"],
    watch: { usePolling: process.env.DOCKER_WATCH_POLLING === "true" },
    fs: { allow: ["../.."] },
    port: Number(process.env.FRONTEND_PORT || 5173),
    proxy: { "/api": process.env.API_INTERNAL_URL || "http://127.0.0.1:3001" },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
