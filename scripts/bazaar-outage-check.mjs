// Run against the local Postman simulation; never contacts Bazaar.
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { testDatabase } from "../tests/helpers.js";
import { initializeDatabase } from "../apps/backend/src/db.js";
import { billingService } from "../apps/backend/src/modules/billing/service.js";
import { bazaarService } from "../apps/backend/src/modules/billing/bazaar.js";
const simulation = new URL(
  process.env.BAZAAR_SIMULATION_URL || "http://127.0.0.1:4019/bazaar",
);
if (!["127.0.0.1", "localhost"].includes(simulation.hostname))
  throw new Error("Use a local simulation");
const fixture = await testDatabase(),
  realFetch = globalThis.fetch;
try {
  await initializeDatabase(fixture.db);
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  Object.assign(process.env, {
    BAZAAR_API_TOKEN: "simulation-only",
    BAZAAR_RSA_PUBLIC_KEY: publicKey.export({ format: "pem", type: "spki" }),
    BAZAAR_SKU_STANDARD: "standard-month",
    BAZAAR_SKU_PROFESSIONAL: "professional-month",
    BAZAAR_SKU_PROFESSIONAL_AI: "ai-month",
  });
  let calls = 0;
  globalThis.fetch = (url, options) => {
    const upstream = new URL(url);
    assert.equal(upstream.hostname, "pardakht.cafebazaar.ir");
    assert.equal(
      options.headers["CAFEBAZAAR-PISHKHAN-API-SECRET"],
      "simulation-only",
    );
    calls++;
    return realFetch(
      simulation.href.replace(/\/$/, "") + upstream.pathname,
      options,
    );
  };
  const owner = randomUUID();
  await fixture.db
    .collection("users")
    .insertOne({ id: owner, lifetime_created: 0 });
  const billing = billingService(fixture.db, fixture.client),
    service = bazaarService(fixture.db, billing);
  const intent = await service.intent(owner, "standard");
  const originalJson = JSON.stringify({
    packageName: "ir.azmounbarg.app",
    productId: intent.productId,
    purchaseToken: "simulation-token",
    purchaseState: 0,
    developerPayload: intent.payload,
  });
  await assert.rejects(
    service.verifyReceipt(owner, {
      originalJson,
      signature: sign(
        "RSA-SHA1",
        Buffer.from(originalJson),
        privateKey,
      ).toString("base64"),
      productId: intent.productId,
      purchaseToken: "simulation-token",
    }),
    { code: "BAZAAR_UNAVAILABLE", status: 503 },
  );
  assert.equal(calls, 1);
  assert.equal(
    await fixture.db
      .collection("subscription_periods")
      .countDocuments({ owner_id: owner }),
    0,
  );
  console.log(
    "PASS: Bazaar HTTP 503 gives a recoverable failure and grants no subscription.",
  );
} finally {
  globalThis.fetch = realFetch;
  await fixture.close();
}
