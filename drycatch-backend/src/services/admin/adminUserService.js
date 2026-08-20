import crypto from "crypto";
import User from "../../models/User.js";
import Role from "../../models/Role.js";
import AdminInvite from "../../models/AdminInvite.js";
import { recordAdminAction } from "./adminAuditService.js";
import { SUPER_ADMIN } from "../../utils/rbac.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Only a SUPER_ADMIN may invite another SUPER_ADMIN (rule #10/#114 —
// privilege escalation) — anyone else inviting with an elevated role is
// rejected outright rather than silently downgrading the request, so the
// failure is visible instead of a confusing "why did they only get ADMIN."
export async function inviteAdmin(inviterId, { email, roleId }, req) {
  const role = await Role.findById(roleId);
  if (!role) fail("Role not found", "ROLE_NOT_FOUND", 404);

  const inviter = await User.findById(inviterId).populate("adminRole");
  if (role.name === SUPER_ADMIN && inviter.adminRole?.name !== SUPER_ADMIN) {
    fail("Only a Super Admin can invite another Super Admin", "PRIVILEGE_ESCALATION_BLOCKED", 403);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) fail("A user with this email already exists", "USER_ALREADY_EXISTS", 409);

  const token = crypto.randomBytes(32).toString("hex");
  const invite = await AdminInvite.create({
    email: email.toLowerCase(), role: roleId, invitedBy: inviterId, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  // No real email delivery is integrated anywhere in this project (same
  // honest gap as utils/otp.js's console-only OTP "delivery") — logging the
  // link is the dev-mode stand-in for a real invite email.
  console.log(`[ADMIN INVITE] ${email} -> /admin/accept-invite?token=${token}`);

  await recordAdminAction({ actor: inviterId, action: "ADMIN_INVITED", entityType: "AdminInvite", entityId: invite._id, after: { email, role: role.name }, req }).catch(() => {});
  return invite;
}

export async function acceptInvite(token, { firstName, lastName, password }) {
  const invite = await AdminInvite.findOne({ token, status: "pending" });
  if (!invite) fail("This invite is invalid or has already been used", "INVITE_INVALID", 404);
  if (invite.expiresAt < new Date()) { invite.status = "expired"; await invite.save(); fail("This invite has expired", "INVITE_EXPIRED", 410); }

  const user = await User.create({
    firstName, lastName, email: invite.email, password, role: "admin", adminRole: invite.role,
    isVerified: true, status: "active",
  });

  invite.status = "accepted";
  invite.acceptedAt = new Date();
  await invite.save();

  await recordAdminAction({ actor: user._id, action: "ADMIN_INVITE_ACCEPTED", entityType: "User", entityId: user._id, after: { email: user.email } }).catch(() => {});
  return user;
}

export async function listAdminUsers({ page = 1, limit = 50 } = {}) {
  const filter = { role: "admin" };
  const [users, total] = await Promise.all([
    User.find(filter).select("firstName lastName email status createdAt").populate("adminRole", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  return { users, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// Rule #114: an admin can never change their own role (self-escalation),
// and only a SUPER_ADMIN can grant the SUPER_ADMIN role to anyone.
export async function updateAdminRole(actorId, targetUserId, newRoleId, req) {
  if (String(actorId) === String(targetUserId)) fail("You cannot change your own role", "SELF_ROLE_CHANGE_BLOCKED", 403);

  const [actor, target, newRole] = await Promise.all([
    User.findById(actorId).populate("adminRole"),
    User.findById(targetUserId).populate("adminRole"),
    Role.findById(newRoleId),
  ]);
  if (!target || target.role !== "admin") fail("Admin user not found", "USER_NOT_FOUND", 404);
  if (!newRole) fail("Role not found", "ROLE_NOT_FOUND", 404);
  if (newRole.name === SUPER_ADMIN && actor.adminRole?.name !== SUPER_ADMIN) {
    fail("Only a Super Admin can grant the Super Admin role", "PRIVILEGE_ESCALATION_BLOCKED", 403);
  }

  const before = { role: target.adminRole?.name };
  target.adminRole = newRoleId;
  await target.save();

  await recordAdminAction({ actor: actorId, action: "ROLE_CHANGED", entityType: "User", entityId: targetUserId, before, after: { role: newRole.name }, req }).catch(() => {});
  return target;
}

export async function deactivateAdmin(actorId, targetUserId, req) {
  if (String(actorId) === String(targetUserId)) fail("You cannot deactivate your own account", "SELF_DEACTIVATION_BLOCKED", 403);
  const target = await User.findOneAndUpdate({ _id: targetUserId, role: "admin" }, { status: "deactivated" }, { new: true });
  if (!target) fail("Admin user not found", "USER_NOT_FOUND", 404);
  await recordAdminAction({ actor: actorId, action: "ADMIN_DEACTIVATED", entityType: "User", entityId: targetUserId, req }).catch(() => {});
  return target;
}

export { fail };
