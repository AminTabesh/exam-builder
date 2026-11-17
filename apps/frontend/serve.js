import express from "express";
import helmet from "helmet";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config({ path: new URL("../../.env", import.meta.url) });
const app = express(),
  api = new URL(process.env.API_INTERNAL_URL || "http://127.0.0.1:3001");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "frame-src": ["'self'", "blob:"],
      },
    },
  }),
);
app.use("/api", (req, res) => {
  const upstream = http.request(
    {
      hostname: api.hostname,
      port: api.port || 80,
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.setTimeout(75000, () => upstream.destroy(new Error("API timeout")));
  upstream.on("error", () => {
    if (!res.headersSent)
      res.status(502).json({ error: "سرویس در دسترس نیست." });
    else res.destroy();
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
const dist = fileURLToPath(new URL("./dist/", import.meta.url));
app.use(express.static(dist));
app.get("/{*splat}", (req, res) => res.sendFile(dist + "index.html"));
const server = app.listen(
  Number(process.env.FRONTEND_PORT || 5173),
  "0.0.0.0",
  () =>
    console.log(
      "Frontend ready on port " + (process.env.FRONTEND_PORT || 5173),
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
