export function databaseStartupMessage(error) {
  if (error.name !== "MongoServerSelectionError") return error.message;
  if (error.reason?.type === "ReplicaSetNoPrimary") {
    const name = error.reason.setName || "the configured replica set";
    return [
      `MongoDB has no reachable primary for replica set "${name}".`,
      "Check that MongoDB is running with replication.replSetName configured, that the replica set is initialized, and that its member hostnames are reachable.",
      "For the supplied Docker setup: docker compose -f compose.dev.yaml up -d --wait",
      'For native MongoDB, see README.md: "Existing MongoDB installations".',
    ].join("\n");
  }
  return [
    "Cannot connect to MongoDB. Start the configured database and check MONGODB_URI in the root .env file.",
    "For the supplied Docker setup: docker compose -f compose.dev.yaml up -d --wait",
  ].join("\n");
}
