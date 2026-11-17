import { parseExam, validateForExport } from "@exam/shared/exam.js";
import { fail } from "../../middleware/errors.js";
import { generatePdf } from "./pdf.js";
export function examRoutes(app, auth, db, billing, checkAssets) {
  const exams = db.collection("exams"),
    users = db.collection("users"),
    publicRecord = { projection: { _id: 0 } };
  const owned = async (id, owner) => {
    const exam = await exams.findOne({ id, owner_id: owner }, publicRecord);
    if (!exam) throw fail(404, "آزمون پیدا نشد.", "EXAM_NOT_FOUND");
    return exam;
  };
  app.get("/api/exams", auth, async (req, res) => {
    res.json(
      await exams
        .find({ owner_id: req.user.id }, publicRecord)
        .sort({ updated_at: -1 })
        .toArray(),
    );
  });
  app.post("/api/exams", auth, async (req, res) => {
    const document = parseExam(req.body.document);
    await checkAssets(document, req.user.id);
    res
      .status(201)
      .json(
        await billing.createExam(req.user.id, document, req.body.creationKey),
      );
  });
  app.get("/api/exams/:id", auth, async (req, res) =>
    res.json(await owned(req.params.id, req.user.id)),
  );
  app.put("/api/exams/:id", auth, async (req, res) => {
    const document = parseExam(req.body.document);
    await checkAssets(document, req.user.id);
    await owned(req.params.id, req.user.id);
    if (!Number.isSafeInteger(req.body.revision) || req.body.revision < 1)
      throw fail(
        409,
        "نسخه آزمون معتبر نیست. آخرین نسخه را بارگذاری کنید.",
        "REVISION_CONFLICT",
      );
    const updated = await billing.transaction(async (session) => {
      await users.updateOne(
        { id: req.user.id },
        { $inc: { font_version: 1 } },
        { session },
      );
      if (
        /^[a-f0-9-]{36}$/.test(document.layout.fontFamily || "") &&
        !(await db
          .collection("fonts")
          .findOne(
            { id: document.layout.fontFamily, owner_id: req.user.id },
            { session },
          ))
      )
        throw fail(422, "فونت پیدا نشد.", "FONT_NOT_FOUND");
      return exams.findOneAndUpdate(
        {
          id: req.params.id,
          owner_id: req.user.id,
          revision: req.body.revision,
        },
        { $set: { document, updated_at: new Date() }, $inc: { revision: 1 } },
        {
          ...publicRecord,
          session,
          returnDocument: "after",
          includeResultMetadata: false,
        },
      );
    });
    if (!updated)
      throw fail(
        409,
        "این آزمون در پنجره دیگری تغییر کرده است. نسخه جدید را باز کنید یا از کار خود یک کپی بسازید.",
        "REVISION_CONFLICT",
      );
    res.json(updated);
  });
  app.delete("/api/exams/:id", auth, async (req, res) => {
    await owned(req.params.id, req.user.id);
    await exams.deleteOne({ id: req.params.id, owner_id: req.user.id });
    res.json({ ok: true });
  });
  app.post("/api/exams/:id/duplicate", auth, async (req, res) => {
    const source = await owned(req.params.id, req.user.id);
    source.document.meta.title += " (کپی)";
    res
      .status(201)
      .json(await billing.createExam(req.user.id, source.document));
  });
  app.post("/api/exams/:id/pdf", auth, async (req, res) => {
    const exam = await owned(req.params.id, req.user.id);
    if (req.body.revision !== exam.revision)
      throw fail(
        409,
        "ابتدا آخرین تغییرات را ذخیره کنید.",
        "REVISION_CONFLICT",
      );
    if (!["student", "answer-key"].includes(req.body.kind))
      throw fail(422, "نوع خروجی معتبر نیست.");
    const issues = validateForExport(exam.document);
    if (issues.length) throw fail(422, issues.join("\n"));
    const assets = await checkAssets(exam.document, req.user.id);
    const { plan } = await billing.current(req.user.id);
    const pdf = await generatePdf(exam.document, req.body.kind, assets, {
      maxPages: plan.pages,
    });
    res
      .type("pdf")
      .set("Content-Disposition", 'attachment; filename="exam.pdf"')
      .send(pdf);
  });
}
