import { client, initializeDatabase } from "./db.js";
try {
  await initializeDatabase();
  console.log("MongoDB collections and indexes are ready.");
} finally {
  await client.close();
}
