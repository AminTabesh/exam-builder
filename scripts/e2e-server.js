import express from "express";
// Isolated test-only server. Never included in the production images.
import { testDatabase } from "../tests/helpers.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { createApp } from "../apps/backend/src/app.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const fixture = await testDatabase();
const assets = await mkdtemp(path.join(tmpdir(), "exam-e2e-"));
process.env.ASSET_DIR = assets;
process.env.APP_URL = "http://localhost:5183";
process.env.NODE_ENV = "test";
await initializeDatabase(fixture.db);
const codes = new Map();
const api = createApp(fixture.db, {
  test: true,
  aiGenerate: async (input) => ({
    questions: Object.entries(input.counts).flatMap(([type, count]) =>
      Array.from({ length: count }, (_, i) => ({
        type,
        body:
          type === "blank"
            ? `نصف عدد ${i + 4} برابر [[blank]] است.`
            : `${type} پرسش آزمایشی ${i + 1}: حاصل یک به علاوه یک چیست؟`,
        options: type === "mcq" ? ["یک", "دو", "سه", "چهار"] : [],
        ...(type === "matching"
          ? {
              leftItems: ["دو برابر $2$", "سه برابر $2$"],
              rightItems: ["$6$", "$4$", "هیچ‌کدام"],
              matchingPairs: [
                { leftIndex: 0, rightIndex: 1 },
                { leftIndex: 1, rightIndex: 0 },
              ],
            }
          : {}),
        correctIndex: type === "mcq" ? 1 : -1,
        answer: "دو",
        explanation: "با جمع یک و یک به عدد دو می‌رسیم.",
      })),
    ),
  }),
  mongoClient: fixture.client,
  deliverOtp: async (identity, code) => codes.set(identity.value, code),
});
const app = express();
app.get("/api/__test/otp", (req, res) =>
  res.json({ code: codes.get(req.query.identifier) }),
);
app.use(api);
const server = app.listen(3101, "127.0.0.1", () =>
  console.log("Isolated browser test API ready"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await fixture.close();
      await rm(assets, { recursive: true, force: true });
      process.exit(0);
    }),
  );
