import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Product from "../models/Product.js";
import { ensureDefaultTenant } from "../services/tenant/tenantProvisioningService.js";

// Phase 25 (rule #15) — migration for the ONE resource this pass fully
// retrofitted (Product; see docs/multi-tenant.md for why the other 79
// models are documented but not migrated in this session). Steps mirror
// the spec exactly:
//   1. backup — operational step, out of this script's scope
//   2. tenantId is already nullable on the schema
//   3. create/find the default/migration tenant
//   4. assign existing resources to it
//   5. validate
//   6. indexes already declared on the schema (created on next connect)
//   7/8. enforcing tenantId + removing fallback behavior is a FOLLOW-UP
//      step, deliberately not done here — flipping `required: true` before
//      every write path is confirmed to always set it (only productService
//      is confirmed in this pass) would start rejecting valid writes from
//      any call site still relying on the pre-Phase-25 default.
//
// Idempotent: running this twice is a no-op the second time (the
// `tenant: { $exists: false }` filter matches nothing once step 4 has run).
// Discovered running this migration for real (not a hypothetical): Mongo
// does not auto-drop a stale single-field unique index just because the
// schema now also declares a compound one — `Product.slug` and
// `Role.name`'s old global-unique indexes kept enforcing global
// uniqueness even after this phase's compound indexes were added, which
// would silently defeat per-tenant slug/name reuse. Dropping them is a
// real, required migration step, not an aside.
async function dropStaleGlobalIndexes() {
  const dropIfExists = async (collectionName, indexName) => {
    try {
      await mongoose.connection.collection(collectionName).dropIndex(indexName);
      console.log(`[migrate] dropped stale index ${collectionName}.${indexName}`);
    } catch (err) {
      if (err.codeName !== "IndexNotFound") throw err;
    }
  };
  await dropIfExists("products", "slug_1");
  await dropIfExists("roles", "name_1");
}

async function run() {
  await connectDB();
  await dropStaleGlobalIndexes();
  const defaultTenant = await ensureDefaultTenant();
  console.log(`[migrate] default tenant: ${defaultTenant.slug} (${defaultTenant._id})`);

  const result = await Product.updateMany(
    { tenant: { $exists: false } },
    { $set: { tenant: defaultTenant._id } }
  );
  console.log(`[migrate] Product: backfilled ${result.modifiedCount} of ${result.matchedCount} matched`);

  const remaining = await Product.countDocuments({ tenant: { $exists: false } });
  const orphaned = await Product.countDocuments({ tenant: { $exists: true, $eq: null } });
  console.log(`[migrate] validation — Product docs still missing tenant: ${remaining}, explicitly-null tenant: ${orphaned}`);

  if (remaining > 0 || orphaned > 0) {
    console.error("[migrate] FAILED validation — some Product documents have no tenant assigned. Not proceeding further.");
    process.exitCode = 1;
  } else {
    console.log("[migrate] OK — every Product document now has a tenantId.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[migrate] fatal error:", err);
  process.exit(1);
});
