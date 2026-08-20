import mongoose from "mongoose";
import crypto from "crypto";

// Phase 25 — a tenant may have several domains (its platform subdomain
// plus, later, a custom domain) but exactly one is ever `isPrimary` at a
// time (rule #30), enforced in tenantDomainService.js rather than here
// (a schema-level uniqueness constraint can't express "unique per tenant
// among only the true values").
const domainSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    domain: { type: String, required: true, lowercase: true, trim: true, unique: true },
    type: { type: String, enum: ["subdomain", "custom_domain"], required: true },
    status: { type: String, enum: ["pending", "verifying", "verified", "active", "failed", "removed"], default: "pending" },
    isPrimary: { type: Boolean, default: false },
    // DNS TXT is the only method implemented (rule #28) — CNAME
    // verification would additionally require this platform to control
    // where the CNAME target resolves, which is a real hosting/CDN
    // dependency this project doesn't have (see docs/multi-tenant.md).
    verificationMethod: { type: String, enum: ["dns_txt"], default: "dns_txt" },
    verificationToken: { type: String, default: () => crypto.randomBytes(16).toString("hex") },
    verifiedAt: Date,
    lastCheckedAt: Date,
    failureReason: String,
  },
  { timestamps: true }
);

domainSchema.index({ tenant: 1, isPrimary: 1 });

export default mongoose.model("TenantDomain", domainSchema);
