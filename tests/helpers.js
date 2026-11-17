import { spawnSync } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
export async function testDatabase() {
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY ||
    spawnSync(process.platform === "win32" ? "where" : "which", ["mongod"], {
      encoding: "utf8",
    })
      .stdout?.trim()
      .split("\n")[0];
  const version =
    systemBinary &&
    (process.env.MONGOMS_VERSION ||
      spawnSync(systemBinary, ["--version"], {
        encoding: "utf8",
      }).stdout?.match(/db version v([\d.]+)/)?.[1]);
  const mongo = await MongoMemoryReplSet.create({
    binary: systemBinary ? { systemBinary, version } : undefined,
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const client = new MongoClient(mongo.getUri());
  await client.connect();
  return {
    mongo,
    client,
    db: client.db("exam_test"),
    close: async () => {
      await client.close();
      await mongo.stop();
    },
  };
}
