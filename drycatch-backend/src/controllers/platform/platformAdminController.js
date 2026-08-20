import Tenant from "../../models/Tenant.js";
import { provisionTenant } from "../../services/tenant/tenantProvisioningService.js";
import { tenantCache } from "../../utils/tenantCache.js";
import { logAuditEvent } from "../../utils/auditLog.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Phase 25 (rule #59) — the platform operator's own back office. Nothing
// here is reachable by a tenant Owner/Admin (see requirePlatformPermission
// in routes) — this is a hard boundary, not a UI-level hide.
export async function listTenants(req, res) {
  const { status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const [tenants, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Tenant.countDocuments(filter),
  ]);
  res.json({ tenants, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}

export async function getTenant(req, res) {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) return res.status(404).json({ message: "Tenant not found" });
  res.json({ tenant });
}

export async function createTenant(req, res) {
  const tenant = await provisionTenant({ name: req.body.name, slug: req.body.slug, ownerUserId: req.body.ownerUserId });
  res.status(201).json({ tenant });
}

// Phase 25 (rule #56) — suspension is reversible and does not touch data;
// contrast with deletion below, which has a retention window before
// anything is actually removed.
export async function suspendTenant(req, res) {
  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { status: "suspended", suspendedAt: new Date(), suspendedReason: req.body.reason },
    { new: true }
  );
  if (!tenant) fail("Tenant not found", "TENANT_NOT_FOUND", 404);
  tenantCache.invalidateAll();
  logAuditEvent("PLATFORM_TENANT_SUSPENDED", req.user._id, { tenantId: tenant._id, reason: req.body.reason });
  res.json({ tenant });
}

export async function reactivateTenant(req, res) {
  const tenant = await Tenant.findByIdAndUpdate(req.params.id, { status: "active", suspendedAt: null, suspendedReason: null }, { new: true });
  if (!tenant) fail("Tenant not found", "TENANT_NOT_FOUND", 404);
  tenantCache.invalidateAll();
  logAuditEvent("PLATFORM_TENANT_REACTIVATED", req.user._id, { tenantId: tenant._id });
  res.json({ tenant });
}

// Phase 25 (rule #57) — requesting deletion starts a retention window; it
// does not delete anything itself. Permanent deletion is a separate,
// deliberately-not-automated operation (no scheduler exists in this
// project — see docs/multi-tenant.md), run manually by a platform admin
// after the retention period, never silently by a cron job.
export async function requestTenantDeletion(req, res) {
  const retentionDays = Number(process.env.TENANT_DELETION_RETENTION_DAYS) || 30;
  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { status: "deletion_requested", deletionRequestedAt: new Date(), deletionEligibleAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000) },
    { new: true }
  );
  if (!tenant) fail("Tenant not found", "TENANT_NOT_FOUND", 404);
  tenantCache.invalidateAll();
  logAuditEvent("PLATFORM_TENANT_DELETION_REQUESTED", req.user._id, { tenantId: tenant._id, deletionEligibleAt: tenant.deletionEligibleAt });
  res.json({ tenant });
}
