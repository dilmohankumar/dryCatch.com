import dns from "dns/promises";
import TenantDomain from "../../models/TenantDomain.js";
import { tenantCache } from "../../utils/tenantCache.js";
import { logAuditEvent } from "../../utils/auditLog.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const RESERVED_DOMAIN_SUFFIXES = [".platform.internal"]; // placeholder for genuinely internal hostnames

export async function addCustomDomain({ tenantId, domain, actorId }) {
  const normalized = domain.toLowerCase().trim();
  if (RESERVED_DOMAIN_SUFFIXES.some((s) => normalized.endsWith(s))) fail("This domain cannot be used", "DOMAIN_RESERVED");

  const existing = await TenantDomain.findOne({ domain: normalized });
  if (existing) fail("This domain is already registered to a store", "DOMAIN_TAKEN", 409);

  const record = await TenantDomain.create({ tenant: tenantId, domain: normalized, type: "custom_domain", status: "pending" });
  logAuditEvent("TENANT_DOMAIN_ADDED", actorId, { tenantId, domain: normalized });
  return record;
}

// Phase 25 (rule #28) — a domain is verified by proving control of its
// DNS, never by trusting the caller's say-so. We ask the tenant to create
// a TXT record at `_drycatch-verify.{domain}` containing the token this
// row was created with, then look it up for real via `dns.resolveTxt`.
export async function verifyDomain({ tenantId, domainId }) {
  const record = await TenantDomain.findOne({ _id: domainId, tenant: tenantId });
  if (!record) fail("Domain not found", "DOMAIN_NOT_FOUND", 404);

  record.status = "verifying";
  record.lastCheckedAt = new Date();

  try {
    const host = `_drycatch-verify.${record.domain}`;
    const txtRecords = await dns.resolveTxt(host);
    const values = txtRecords.flat();
    const found = values.some((v) => v.includes(record.verificationToken));

    if (!found) {
      record.status = "failed";
      record.failureReason = `Expected TXT record at ${host} containing ${record.verificationToken}, none found`;
      await record.save();
      return record;
    }

    record.status = "verified";
    record.verifiedAt = new Date();
    await record.save();
    tenantCache.invalidateAll();
    logAuditEvent("TENANT_DOMAIN_VERIFIED", tenantId, { tenantId, domain: record.domain });
    return record;
  } catch (err) {
    record.status = "failed";
    record.failureReason = err.code === "ENOTFOUND" || err.code === "ENODATA" ? "No TXT record found at the verification hostname" : err.message;
    await record.save();
    return record;
  }
}

// Phase 25 (rule #30) — exactly one primary domain per tenant. Making a
// verified domain primary demotes whichever one currently holds it, in
// the same operation, so there's never a moment with zero or two primaries.
export async function setPrimaryDomain({ tenantId, domainId, actorId }) {
  const record = await TenantDomain.findOne({ _id: domainId, tenant: tenantId });
  if (!record) fail("Domain not found", "DOMAIN_NOT_FOUND", 404);
  if (!["verified", "active"].includes(record.status)) fail("Only a verified domain can become primary", "DOMAIN_NOT_VERIFIED");

  await TenantDomain.updateMany({ tenant: tenantId, _id: { $ne: record._id } }, { isPrimary: false });
  record.isPrimary = true;
  record.status = "active";
  await record.save();
  tenantCache.invalidateAll();
  logAuditEvent("TENANT_PRIMARY_DOMAIN_CHANGED", actorId, { tenantId, domain: record.domain });
  return record;
}

export async function listDomains(tenantId) {
  return TenantDomain.find({ tenant: tenantId }).sort({ isPrimary: -1, createdAt: 1 });
}

export async function removeDomain({ tenantId, domainId, actorId }) {
  const record = await TenantDomain.findOne({ _id: domainId, tenant: tenantId });
  if (!record) fail("Domain not found", "DOMAIN_NOT_FOUND", 404);
  if (record.isPrimary) fail("Cannot remove the primary domain — set another domain as primary first", "CANNOT_REMOVE_PRIMARY");
  record.status = "removed";
  await record.save();
  tenantCache.invalidateAll();
  logAuditEvent("TENANT_DOMAIN_REMOVED", actorId, { tenantId, domain: record.domain });
  return record;
}
