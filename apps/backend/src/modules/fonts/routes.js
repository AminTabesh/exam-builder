import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import * as fontkit from "fontkit";
import { fail } from "../../middleware/errors.js";
export function fontRoutes(app, auth, upload, db, billing, root) {
  const fonts = db.collection("fonts");
  const view = (f) => ({ id: f.id, name: f.name, created_at: f.created_at });
  app.get("/api/fonts", auth, async (req, res) =>
    res.json((await fonts.find({ owner_id: req.user.id }).toArray()).map(view)),
  );
  app.post("/api/fonts", auth, upload.single("font"), async (req, res) => {
    if (!req.file || req.body.licenseConfirmed !== "true")
      throw fail(
        422,
        "فایل فونت و تأیید مجوز استفاده لازم است.",
        "INVALID_FONT",
      );
    const signature = req.file.buffer.subarray(0, 4).toString("hex");
    if (!["00010000", "4f54544f", "74727565"].includes(signature))
      throw fail(422, "فونت TTF یا OTF معتبر انتخاب کنید.", "INVALID_FONT");
    let font;
    try {
      font = fontkit.create(req.file.buffer);
      if (
        !font.numGlyphs ||
        font.numGlyphs > 65535 ||
        !font.characterSet?.length ||
        font.fonts
      )
        throw new Error();
      // Validate metadata here. fontkit's optional shaping engine crashes on
      // legacy contextual GSUB tables used by valid B Nazanin / B Yekan TTFs.
      // Preview and PDF rendering use Chromium's independent font engine.
    } catch {
      throw fail(422, "ساختار فونت معتبر نیست.", "INVALID_FONT");
    }
    const id = randomUUID(),
      filename = `${id}.${signature === "4f54544f" ? "otf" : "ttf"}`;
    const row = {
      id,
      owner_id: req.user.id,
      name: String(font.familyName || req.file.originalname).slice(0, 100),
      filename,
      license_confirmed_at: new Date(),
      created_at: new Date(),
    };
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, filename), req.file.buffer, { flag: "wx" });
    try {
      await billing.transaction(async (session) => {
        const owner = await db
          .collection("users")
          .updateOne(
            { id: req.user.id, status: { $nin: ["suspended", "deleting"] } },
            { $inc: { font_version: 1 } },
            { session },
          );
        if (!owner.matchedCount) throw fail(403, "حساب فعال نیست.");
        if (
          (await fonts.countDocuments(
            { owner_id: req.user.id },
            { session },
          )) >= 10
        )
          throw fail(422, "حداکثر ده فونت در حساب مجاز است.", "FONT_QUOTA");
        await fonts.insertOne({ ...row }, { session });
      });
    } catch (e) {
      await unlink(path.join(root, filename));
      throw e;
    }
    res.status(201).json(view(row));
  });
  app.get("/api/fonts/:id/file", auth, async (req, res) => {
    const font = await fonts.findOne({
      id: req.params.id,
      owner_id: req.user.id,
    });
    if (!font) throw fail(404, "فونت پیدا نشد.", "FONT_NOT_FOUND");
    res
      .type(font.filename.endsWith(".otf") ? "font/otf" : "font/ttf")
      .sendFile(path.join(root, font.filename));
  });
  app.delete("/api/fonts/:id", auth, async (req, res) => {
    let font;
    await billing.transaction(async (session) => {
      await db
        .collection("users")
        .updateOne(
          { id: req.user.id },
          { $inc: { font_version: 1 } },
          { session },
        );
      font = await fonts.findOne(
        { id: req.params.id, owner_id: req.user.id },
        { session },
      );
      if (!font) throw fail(404, "فونت پیدا نشد.", "FONT_NOT_FOUND");
      if (
        await db
          .collection("exams")
          .findOne(
            { owner_id: req.user.id, "document.layout.fontFamily": font.id },
            { session },
          )
      )
        throw fail(
          409,
          "این فونت در یک آزمون ذخیره‌شده استفاده می‌شود.",
          "FONT_IN_USE",
        );
      await fonts.deleteOne({ id: font.id }, { session });
    });
    await unlink(path.join(root, font.filename)).catch(() => {});
    res.json({ ok: true });
  });
}
