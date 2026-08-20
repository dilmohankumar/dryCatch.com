import Role from "../models/Role.js";
import { DEFAULT_ROLES, PLATFORM_DEFAULT_ROLES } from "./rbac.js";

// Idempotent upsert, run once at server boot (see server.js) — never
// destructive: an admin's edits to a seeded role's permission list survive
// a restart (only missing roles are created, existing ones aren't reset).
//
// Phase 25 — these remain seeded as tenant: null (global) rows for
// backward compatibility with every pre-Phase-25 dev/test flow that looks
// up e.g. `Role.findOne({ name: "SUPER_ADMIN" })` with no tenant filter.
// A genuinely NEW tenant created after this phase gets its OWN copies of
// these same role definitions via tenantProvisioningService.seedTenantRoles
// (tenant-scoped rows, name collision is fine — uniqueness is now
// per-(tenant, name), not global).
export async function seedRoles() {
  for (const role of DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { name: role.name, tenant: null },
      { $setOnInsert: role },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

export async function seedPlatformRoles() {
  for (const role of PLATFORM_DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { name: role.name, tenant: null },
      { $setOnInsert: role },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}
