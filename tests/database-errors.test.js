import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseStartupMessage } from "../apps/backend/src/config/database-errors.js";

test("missing replica primary explains initialization and hostname checks", () => {
  const message = databaseStartupMessage({
    name: "MongoServerSelectionError",
    reason: { type: "ReplicaSetNoPrimary", setName: "rs0" },
    message: "Server selection timed out after 5000 ms",
  });
  assert.match(message, /rs0/);
  assert.match(message, /initialized/);
  assert.match(message, /hostnames/);
  assert.match(message, /README/);
});

test("unreachable databases give setup guidance without echoing connection secrets", () => {
  const message = databaseStartupMessage({
    name: "MongoServerSelectionError",
    reason: { type: "Unknown" },
    message: "mongodb://user:secret@example.invalid/exam",
  });
  assert.match(message, /MONGODB_URI/);
  assert.ok(!message.includes("secret"));
});

test("non-connection startup errors retain their actual explanation", () => {
  assert.equal(
    databaseStartupMessage(new Error("SESSION_SECRET is required")),
    "SESSION_SECRET is required",
  );
});
