import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fail } from "../../middleware/errors.js";
export function assetRoutes(app, auth, db, upload, assetRoot, billing) {
  const assets = db.collection("assets");
  app.post("/api/assets", auth, upload.single("image"), async (req, res) => {
    if (!req.file) throw fail(422, "یک تصویر انتخاب کنید.");
    const id = randomUUID(),
      filename = id + ".webp";
    await mkdir(assetRoot, { recursive: true });
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!["png", "jpeg", "webp"].includes(metadata.format))
        throw new Error("Unsupported image");
      await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(path.join(assetRoot, filename));
    } catch {
      throw fail(
        422,
        "تصویر معتبر PNG، JPEG یا WebP با حداکثر ۵ مگابایت انتخاب کنید.",
      );
    }
    try {
      await billing.transaction(async (session) => {
        const owner = await db
          .collection("users")
          .updateOne(
            { id: req.user.id, status: { $nin: ["suspended", "deleting"] } },
            { $inc: { asset_version: 1 } },
            { session },
          );
        if (!owner.matchedCount) throw fail(403, "حساب فعال نیست.");
        await assets.insertOne(
          {
            id,
            owner_id: req.user.id,
            filename,
            created_at: new Date(),
          },
          { session },
        );
      });
    } catch (e) {
      await unlink(path.join(assetRoot, filename));
      throw e;
    }
    res.status(201).json({ src: "/api/assets/" + id });
  });
  app.get("/api/assets/:id", auth, async (req, res) => {
    const asset = await assets.findOne({
      id: req.params.id,
      owner_id: req.user.id,
    });
    if (!asset) throw fail(404, "تصویر پیدا نشد.");
    res.type("webp").sendFile(path.join(assetRoot, asset.filename));
  });
}
