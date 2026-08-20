import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Real, dedicated, isolated test database (rule #6/#7) — an in-memory
// MongoDB instance, not the developer's local `drycatch` database and
// nowhere near production. Every test file that needs the DB calls
// startTestDb() in beforeAll and stopTestDb() in afterAll; clearTestDb()
// between tests gives each test a clean slate (rule #8 — test isolation)
// without the overhead of tearing down and recreating the whole server
// per test.
let mongod;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Mongoose builds indexes asynchronously in the background after connect
  // (autoIndex fires-and-forgets); without waiting for them, a test that
  // relies on a unique index (e.g. loyalty ledger idempotency) can race
  // ahead of the index actually existing and silently allow a duplicate.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function stopTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
