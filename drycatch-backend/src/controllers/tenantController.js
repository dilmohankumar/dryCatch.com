import Tenant from "../models/Tenant.js";
import * as membershipService from "../services/tenant/tenantMembershipService.js";
import * as domainService from "../services/tenant/tenantDomainService.js";
import { validateTenantSlug } from "../utils/tenantSlug.js";
import { logAuditEvent } from "../utils/auditLog.js";

// ── Self-service: the current tenant (resolved by requireTenant) ──────────
export async function getCurrentTenant(req, res) {
  res.json({ tenant: req.tenant });
}

const SETTINGS_CATEGORIES = ["branding", "commerce", "seo", "growth"];

export async function updateSettings(req, res) {
  const category = req.params.category;
  if (!SETTINGS_CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `Unknown settings category: ${category}`, code: "INVALID_SETTINGS_CATEGORY" });
  }
  const tenant = await Tenant.findById(req.tenant._id);
  tenant.settings[category] = { ...tenant.settings[category]?.toObject?.(), ...req.body };
  await tenant.save();
  logAuditEvent("TENANT_SETTINGS_UPDATED", req.user._id, { tenantId: tenant._id, category });
  res.json({ tenant });
}

export async function checkSlugAvailable(req, res) {
  const slug = req.query.slug || "";
  const error = validateTenantSlug(slug);
  if (error) return res.json({ available: false, reason: error });
  const existing = await Tenant.findOne({ slug: slug.toLowerCase() });
  res.json({ available: !existing, reason: existing ? "This store URL is already taken" : null });
}

// ── Team / memberships ──────────────────────────────────────────────────
export async function listMembers(req, res) {
  res.json({ members: await membershipService.listMembers(req.tenant._id) });
}
export async function inviteMember(req, res) {
  const { email, roleId } = req.body;
  const membership = await membershipService.inviteMember({ tenantId: req.tenant._id, email, roleId, invitedBy: req.user._id });
  res.status(201).json({ membership });
}
export async function revokeMember(req, res) {
  const membership = await membershipService.revokeMember({ tenantId: req.tenant._id, membershipId: req.params.id, actorId: req.user._id });
  res.json({ membership });
}
export async function acceptInvite(req, res) {
  const membership = await membershipService.acceptInvite({ token: req.body.token, userId: req.user._id });
  res.json({ membership });
}
export async function myMemberships(req, res) {
  res.json({ memberships: await membershipService.listMembershipsForUser(req.user._id) });
}

// ── Domains ─────────────────────────────────────────────────────────────
export async function listDomains(req, res) {
  res.json({ domains: await domainService.listDomains(req.tenant._id) });
}
export async function addDomain(req, res) {
  const domain = await domainService.addCustomDomain({ tenantId: req.tenant._id, domain: req.body.domain, actorId: req.user._id });
  res.status(201).json({ domain });
}
export async function verifyDomain(req, res) {
  const domain = await domainService.verifyDomain({ tenantId: req.tenant._id, domainId: req.params.id });
  res.json({ domain });
}
export async function setPrimaryDomain(req, res) {
  const domain = await domainService.setPrimaryDomain({ tenantId: req.tenant._id, domainId: req.params.id, actorId: req.user._id });
  res.json({ domain });
}
export async function removeDomain(req, res) {
  const domain = await domainService.removeDomain({ tenantId: req.tenant._id, domainId: req.params.id, actorId: req.user._id });
  res.json({ domain });
}
