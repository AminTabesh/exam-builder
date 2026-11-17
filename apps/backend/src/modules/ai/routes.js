import { aiService } from "./service.js";
export function aiRoutes(app, auth, db, billing, options) {
  const ai = aiService(db, billing, options);
  app.get("/api/ai/status", auth, async (req, res) =>
    res.json(await ai.status(req.user.id)),
  );
  app.post("/api/ai/generate", auth, async (req, res) =>
    res.json(await ai.generate(req.user.id, req.body)),
  );
}
