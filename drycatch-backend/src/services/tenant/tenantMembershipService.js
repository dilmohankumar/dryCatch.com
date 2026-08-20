import crypto from "crypto";
import TenantMembership from "../../models/TenantMembership.js";
import Role from "../../models/Role.js";
import User from "../../models/User.js";
import { logAuditEvent } from "../../utils/auditLog.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const INVITE_EXPIRY_DAYS = 7;

// Phase 25 (rule #21) — one active/pending invite per (tenant, email) is
// enforced at the DB layer (TenantMembership's partial unique indexes);
// re-inviting an already-invited address updates that same row (a fresh
// token + expiry) instead of erroring, since "resend" is a named feature.
export async function inviteMember({ tenantId, email, roleId, invitedBy }) {
  const role = await Role.findOne({ _id: roleId, tenant: tenantId });
  if (!role) fail("That role does not belong to this store", "INVALID_ROLE");

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  const token = TenantMembership.generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const filter = existingUser ? { tenant: tenantId, user: existingUser._id } : { tenant: tenantId, invitedEmail: normalizedEmail };
  const membership = await TenantMembership.findOneAndUpdate(
    filter,
    {
      tenant: tenantId,
      user: existingUser?._id,
      invitedEmail: existingUser ? undefined : normalizedEmail,
      role: roleId,
      status: "invited",
      invitedBy,
      inviteToken: token,
      inviteExpiresAt,
    },
    { upsert: true, new: true }
  );

  logAuditEvent("TENANT_MEMBER_INVITED", invitedBy, { tenantId, email: normalizedEmail, roleId });
  // Actual email delivery reuses the Phase 16 notification pipeline in a
  // real deployment — kept out of this service (single-responsibility)
  // and documented in docs/multi-tenant.md as a wiring TODO, matching how
  // every other "send a notification for X" call site in this codebase
  // is a deliberate, separate step.
  return membership;
}

export async function acceptInvite({ token, userId }) {
  const membership = await TenantMembership.findOne({ inviteToken: token }).select("+inviteToken");
  if (!membership) fail("Invalid or expired invitation", "INVITE_NOT_FOUND", 404);
  if (membership.status !== "invited") fail("This invitation has already been used", "INVITE_ALREADY_USED", 409);
  if (membership.inviteExpiresAt && membership.inviteExpiresAt < new Date()) {
    membership.status = "expired";
    await membership.save();
    fail("This invitation has expired", "INVITE_EXPIRED", 410);
  }

  membership.user = userId;
  membership.status = "active";
  membership.joinedAt = new Date();
  membership.inviteToken = undefined;
  membership.inviteExpiresAt = undefined;
  await membership.save();

  logAuditEvent("TENANT_MEMBER_JOINED", userId, { tenantId: membership.tenant, membershipId: membership._id });
  return membership;
}

export async function revokeMember({ tenantId, membershipId, actorId }) {
  const membership = await TenantMembership.findOneAndUpdate(
    { _id: membershipId, tenant: tenantId },
    { status: "revoked" },
    { new: true }
  );
  if (!membership) fail("Membership not found", "MEMBERSHIP_NOT_FOUND", 404);
  logAuditEvent("TENANT_MEMBER_REVOKED", actorId, { tenantId, membershipId });
  return membership;
}

export async function listMembers(tenantId) {
  return TenantMembership.find({ tenant: tenantId, status: { $ne: "revoked" } })
    .populate("user", "firstName lastName email")
    .populate("role", "name permissions")
    .sort({ createdAt: -1 });
}

// Phase 25 (rule #16) — every tenant a given user can act within, used to
// build the "switch store" UI and to validate that a logged-in user
// actually belongs to `req.tenant` before letting them touch tenant-admin
// endpoints.
export async function listMembershipsForUser(userId) {
  return TenantMembership.find({ user: userId, status: "active" })
    .populate("tenant", "name slug status plan")
    .populate("role", "name permissions");
}
