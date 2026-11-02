import "dotenv/config";
import { MongoClient } from "mongodb";
export const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/exam",
  { serverSelectionTimeoutMS: 2500 },
);
export const db = client.db(process.env.MONGODB_DB || undefined);
export async function initializeDatabase(database = db) {
  await database.command({ ping: 1 });
  await Promise.all([
    database.collection("users").createIndex({ id: 1 }, { unique: true }),
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    database.collection("users").createIndex({ "tokens.digest": 1 }),
    database.collection("exams").createIndex({ id: 1 }, { unique: true }),
    database.collection("exams").createIndex({ owner_id: 1, updated_at: -1 }),
    database.collection("assets").createIndex({ id: 1 }, { unique: true }),
    database.collection("assets").createIndex({ owner_id: 1 }),
    database
      .collection("sessions")
      .createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
