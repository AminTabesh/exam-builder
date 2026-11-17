import path from "node:path";
import { embeddedImages, assetIds } from "@exam/shared/exam.js";
import { fail } from "../../middleware/errors.js";
export function assetService(db, assetRoot) {
  const assets = db.collection("assets");
  const checkAssets = async (document, owner) => {
    if (embeddedImages(document).length)
      throw fail(422, "تصویرهای محلی را پیش از ذخیره در حساب بارگذاری کنید.");
    const map = new Map();
    for (const id of assetIds(document)) {
      const asset = await assets.findOne({ id, owner_id: owner });
      if (!asset) throw fail(422, "تصویر متعلق به این حساب نیست.");
      map.set("/api/assets/" + id, path.join(assetRoot, asset.filename));
    }
    if (/^[a-f0-9-]{36}$/.test(document.layout.fontFamily || "")) {
      const font = await db
        .collection("fonts")
        .findOne({ id: document.layout.fontFamily, owner_id: owner });
      if (!font)
        throw fail(422, "فونت متعلق به این حساب نیست.", "FONT_NOT_FOUND");
      map.set(
        `/api/fonts/${font.id}/file`,
        path.join(assetRoot, "fonts", font.filename),
      );
    }
    return map;
  };
  return { checkAssets };
}
