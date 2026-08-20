import mongoose from "mongoose";
import crypto from "crypto";

// Phase 25 (rule #16/#17) — the join model that lets one User belong to
// many Tenants with a different role in each, instead of a single
// tenantId living directly on User. `user` is absent for a pending
// invitation to someone who doesn't have an account yet — `invitedEmail`
// carries the destination until they sign up and the invite is accepted.
const membershipSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    invitedEmail: { type: String, lowercase: true, trim: true },
    // Tenant-scoped role (see models/Role.js — the same Role collection
    // now also holds tenant-scoped roles, distinguished by Role.tenant
    // being set vs. null for platform/system roles).
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    status: { type: String, enum: ["invited", "active", "revoked", "expired"], default: "invited" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inviteToken: { type: String, select: false },
    inviteExpiresAt: Date,
    joinedAt: Date,
  },
  { timestamps: true }
);

// One active/invited membership per (tenant, user) — re-inviting an
// existing member should update the existing row, never create a
// duplicate (rule #21 "do not allow duplicate active invitations").
membershipSchema.index({ tenant: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });
membershipSchema.index({ tenant: 1, invitedEmail: 1 }, { unique: true, partialFilterExpression: { invitedEmail: { $type: "string" } } });

membershipSchema.statics.generateInviteToken = function () {
  return crypto.randomBytes(24).toString("hex");
};

export default mongoose.model("TenantMembership", membershipSchema);
