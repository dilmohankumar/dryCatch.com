import mongoose from "mongoose";

// Granular RBAC (rule #7/#8) layered ON TOP OF, not replacing, the
// existing binary User.role ("customer"/"admin") that 13 prior phases'
// worth of `adminOnly` middleware already depends on. Rewriting every
// `adminOnly` call site to a dynamic permission check would be a massive,
// risky churn across the whole codebase for this pass; instead, `role:
// "admin"` remains the coarse "is this person staff at all" gate, and
// `User.adminRole` (a ref to this model) is the finer-grained permission
// set consulted by NEW Phase 14 endpoints (dashboard, audit logs, role/
// admin-user management) and by `requirePermission()` wherever a phase's
// existing admin endpoint chooses to add one. This is a deliberate,
// documented layering, not an oversight.
const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, uppercase: true, trim: true },
    description: String,
    permissions: [{ type: String }], // e.g. "products.update" — see utils/rbac.js#PERMISSIONS for the full catalog
    // Seeded roles (SUPER_ADMIN, ADMIN, CATALOG_MANAGER, ...) are not
    // deletable and not renamable — protects against an admin accidentally
    // breaking the roles every seeded permission check assumes exist.
    isSystem: { type: Boolean, default: false },
    // Phase 25 — absent/null means a PLATFORM role (seeded once, shared
    // across the whole platform, e.g. PLATFORM_OWNER); set means a
    // tenant-scoped role usable only via that tenant's TenantMembership
    // rows. Reusing this one collection for both, distinguished by this
    // field, avoids maintaining two near-identical role systems.
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  },
  { timestamps: true }
);

// A role name is unique within its scope: once among platform roles
// (tenant: null), and independently once per tenant — two different
// tenants (or the platform) may each have their own "MANAGER" role
// without colliding.
roleSchema.index({ tenant: 1, name: 1 }, { unique: true });

export default mongoose.model("Role", roleSchema);
