import Tenant from "../../models/Tenant.js";
import TenantDomain from "../../models/TenantDomain.js";
import TenantMembership from "../../models/TenantMembership.js";
import Role from "../../models/Role.js";
import { DEFAULT_ROLES } from "../../utils/rbac.js";
import { validateTenantSlug } from "../../utils/tenantSlug.js";
import { tenantCache } from "../../utils/tenantCache.js";
import { logAuditEvent } from "../../utils/auditLog.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Phase 25 (rule #18) — every new tenant gets its OWN copies of the
// standard role templates (not shared rows), scoped by `tenant`, so a
// tenant can later customize its own "CATALOG_MANAGER" permission set
// without affecting any other tenant or the global dev/test defaults.
async function seedTenantRoles(tenantId) {
  const created = {};
  for (const role of DEFAULT_ROLES) {
    const doc = await Role.findOneAndUpdate(
      { tenant: tenantId, name: role.name },
      { $setOnInsert: { ...role, tenant: tenantId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    created[role.name] = doc;
  }
  return created;
}

// Phase 25 (rule #79) — provisioning is a fixed pipeline, and idempotent:
// re-running it for a tenant that already has its subdomain/roles/owner
// membership is a no-op for each already-completed step, not a duplicate.
// A partial failure (rule #80) leaves the tenant record itself intact
// (never rolled back/deleted) so it can be retried rather than vanishing
// into "invisible broken state".
export async function provisionTenant({ name, slug, ownerUserId }) {
  const slugError = validateTenantSlug(slug);
  if (slugError) fail(slugError, "INVALID_SLUG");

  const existing = await Tenant.findOne({ slug: slug.toLowerCase() });
  if (existing) fail("This store URL is already taken", "SLUG_TAKEN", 409);

  const tenant = await Tenant.create({ name, slug: slug.toLowerCase() });

  await TenantDomain.findOneAndUpdate(
    { tenant: tenant._id, type: "subdomain" },
    { $setOnInsert: { tenant: tenant._id, domain: `${tenant.slug}.${process.env.PLATFORM_DOMAIN || "drycatch.test"}`, type: "subdomain", status: "active", isPrimary: true, verifiedAt: new Date() } },
    { upsert: true }
  );

  const roles = await seedTenantRoles(tenant._id);

  if (ownerUserId) {
    await TenantMembership.findOneAndUpdate(
      { tenant: tenant._id, user: ownerUserId },
      { $setOnInsert: { tenant: tenant._id, user: ownerUserId, role: roles.OWNER._id, status: "active", joinedAt: new Date() } },
      { upsert: true }
    );
  }

  tenantCache.invalidateAll();
  logAuditEvent("TENANT_PROVISIONED", ownerUserId, { tenantId: tenant._id, slug: tenant.slug });
  return tenant;
}

// Phase 25 migration support (rule #15) — every pre-Phase-25 record in
// this database belongs to the one store this project has always been.
// This creates (once, idempotently) the tenant that
// scripts/migrateAddTenantId.js assigns all of that existing data to, so
// the migration has a real, valid tenantId to backfill rather than a
// placeholder. Safe to call on every boot — a no-op once it exists.
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";

export async function ensureDefaultTenant() {
  let tenant = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG });
  if (tenant) return tenant;

  tenant = await Tenant.create({ name: "Default Store", slug: DEFAULT_TENANT_SLUG, status: "active" });
  await TenantDomain.findOneAndUpdate(
    { tenant: tenant._id, type: "subdomain" },
    { $setOnInsert: { tenant: tenant._id, domain: `${DEFAULT_TENANT_SLUG}.${process.env.PLATFORM_DOMAIN || "drycatch.test"}`, type: "subdomain", status: "active", isPrimary: true, verifiedAt: new Date() } },
    { upsert: true }
  );
  await seedTenantRoles(tenant._id);
  tenantCache.invalidateAll();
  return tenant;
}
