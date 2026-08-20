import "dotenv/config";
import mongoose from "mongoose";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { validateEnv, config } from "./src/config/env.js";
import { seedRoles, seedPlatformRoles } from "./src/utils/seedRoles.js";
import { seedSuperAdmin } from "./src/utils/seedSuperAdmin.js";
import { ensureDefaultTenant } from "./src/services/tenant/tenantProvisioningService.js";

// Fail fast on missing/placeholder config (Phase 21, rule #8) — before
// ever touching the database or opening a port.
validateEnv();

let server;

connectDB()
  .then(async () => {
    await seedRoles(); // idempotent — safe on every boot
    await seedPlatformRoles(); // Phase 25 — platform-operator roles, separate from tenant roles above
    await ensureDefaultTenant(); // Phase 25 — the tenant every pre-migration record belongs to
    await seedSuperAdmin(); // no-op unless ADMIN_BOOTSTRAP_EMAIL/PASSWORD are set and no admin exists yet
    server = app.listen(config.port, () => console.log(`drycatch-backend listening on port ${config.port}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// Graceful shutdown (Phase 21, rule #39) — stop accepting new connections,
// let in-flight requests finish, then close the DB connection before
// exiting. A container orchestrator (or `docker stop`) sends SIGTERM first
// and only escalates to SIGKILL after a grace period, so handling it
// properly is what turns a deploy/restart into a non-event for whoever's
// mid-checkout instead of a dropped connection.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, closing gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error("[shutdown] graceful shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    console.log("[shutdown] HTTP server closed");
  }
  await mongoose.connection.close(false);
  console.log("[shutdown] MongoDB connection closed");
  clearTimeout(forceExitTimer);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
