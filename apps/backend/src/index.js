import "./config/env.js";
import { client, db, initializeDatabase } from "./db.js";
import { createApp } from "./app.js";
import { databaseStartupMessage } from "./config/database-errors.js";
import { bazaarService, bazaarConfigured } from "./modules/billing/bazaar.js";
import { billingService } from "./modules/billing/service.js";
let server, billingTimer;
async function reconcileBazaar() {
  if (!bazaarConfigured()) return;
  const service = bazaarService(db, billingService(db, client));
  const owners = await db
    .collection("bazaar_subscriptions")
    .distinct("owner_id", {
      expires_at: { $gt: new Date(Date.now() - 7 * 86400000) },
    });
  for (const owner of owners) {
    if (
      !(await db
        .collection("users")
        .findOne({ id: owner, status: { $ne: "deleting" } }))
    )
      continue;
    try {
      await service.reconcile(owner);
    } catch {
      console.warn(JSON.stringify({ event: "bazaar_reconcile_failed" }));
    }
  }
}
async function start() {
  await initializeDatabase();
  let reconciling = false;
  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      await reconcileBazaar();
    } catch {
      console.warn(JSON.stringify({ event: "bazaar_reconcile_failed" }));
    } finally {
      reconciling = false;
    }
  };
  billingTimer = setInterval(reconcile, 15 * 60000);
  billingTimer.unref();
  void reconcile();
  server = createApp(db, { mongoClient: client }).listen(
    process.env.PORT || 3001,
    () =>
      console.log("Exam server ready on port " + (process.env.PORT || 3001)),
  );
}
start().catch(async (error) => {
  console.error("Backend startup failed:\n" + databaseStartupMessage(error));
  await client.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(billingTimer);
    server?.close(async () => {
      await client.close();
      process.exit(0);
    });
  });
