import "dotenv/config";
import { client, db, initializeDatabase } from "./db.js";
import { createApp } from "./app.js";
await initializeDatabase();
const server = createApp(db, { mongoClient: client }).listen(
  process.env.PORT || 3001,
  () => console.log("Exam server ready on port " + (process.env.PORT || 3001)),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await client.close();
      process.exit(0);
    }),
  );
