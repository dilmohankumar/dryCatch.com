import User from "../models/User.js";

// The full permission catalog (rule #8) — grouped exactly like the admin
// sidebar's module list, so adding a new admin feature means adding a
// permission string here, never a scattered `if (role === "admin")`
// (rule #9).
export const PERMISSIONS = {
  PRODUCTS: ["products.read", "products.create", "products.update", "products.delete"],
  INVENTORY: ["inventory.read", "inventory.update"],
  ORDERS: ["orders.read", "orders.update", "orders.refund"],
  CUSTOMERS: ["customers.read", "customers.update", "customers.block"],
  DISCOUNTS: ["discounts.read", "discounts.create", "discounts.update", "discounts.delete"],
  REVIEWS: ["reviews.read", "reviews.moderate"],
  SEARCH: ["search.read", "search.manage"],
  // Phase 17 — Analytics. `analytics.read` covers the general dashboard;
  // per-category permissions exist so a role can be scoped narrowly (e.g.
  // a warehouse manager gets `analytics.inventory.read` without seeing
  // customer/payment data). `analytics.rebuild` is deliberately separate
  // and high-level (rule #116) — rebuilding aggregates from source data is
  // a correctness-critical, potentially expensive operation.
  ANALYTICS: [
    "analytics.read",
    "analytics.sales.read",
    "analytics.customers.read",
    "analytics.products.read",
    "analytics.inventory.read",
    "analytics.payments.read",
    "analytics.shipping.read",
    "analytics.marketing.read",
    "analytics.export",
    "analytics.reports.manage",
    "analytics.reports.send",
    "analytics.rebuild",
  ],
  SETTINGS: ["settings.read", "settings.update"],
  ADMINISTRATION: ["administration.manage_admins", "administration.manage_roles", "administration.view_audit_logs"],
  // Phase 15 — CMS. `cms.pages.publish` is deliberately separate from
  // `cms.pages.update` (rule #71: "do not allow every content editor to
  // publish production content") — a CONTENT_WRITER can hold one without
  // the other.
  CMS: [
    "cms.pages.read", "cms.pages.create", "cms.pages.update", "cms.pages.publish", "cms.pages.delete",
    "cms.blog.read", "cms.blog.create", "cms.blog.update", "cms.blog.publish", "cms.blog.delete",
    "cms.media.upload", "cms.media.delete",
    "cms.seo.update", "cms.navigation.update", "cms.redirects.manage",
  ],
  // Phase 16 — Notifications. `notifications.campaigns.create` is
  // deliberately separate from `notifications.campaigns.send` (rule #107)
  // — creating a marketing campaign is not itself permission to blast it
  // to the whole customer base.
  NOTIFICATIONS: [
    "notifications.read",
    "notifications.send",
    "notifications.templates.manage",
    "notifications.campaigns.create",
    "notifications.campaigns.send",
    "notifications.providers.manage",
    "notifications.analytics.read",
  ],
  // Phase 24 — Growth. `growth.loyalty.manage` covers manual point
  // adjustments (a financial-adjacent action, kept separate from ordinary
  // read access); `growth.flags.manage` is separate again since feature
  // flags can affect checkout/payment behavior (rule #48/#68 — "do not
  // give all admins access to every growth feature").
  GROWTH: [
    "growth.analytics.read",
    "growth.recommendations.manage",
    "growth.loyalty.read",
    "growth.loyalty.manage",
    "growth.referrals.read",
    "growth.referrals.manage",
    "growth.flags.read",
    "growth.flags.manage",
    "growth.abandoned_cart.trigger",
  ],
  // Phase 25 — these three groups are TENANT-level (available to a
  // tenant's own Owner/Admin, scoped to that one tenant via
  // TenantMembership) — distinct from PLATFORM_PERMISSIONS below, which
  // govern the platform operator's own back office (rule #19/#20: "a
  // platform admin is not automatically a tenant admin", and the reverse
  // also holds — a tenant Owner never gets platform.* permissions).
  TEAM: ["team.read", "team.manage"],
  DOMAINS: ["domains.read", "domains.manage"],
  BILLING: ["billing.read", "billing.manage"],
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

// Phase 25 — platform-operator permissions. Never assignable via a
// tenant-scoped Role (see Role.tenant / seedPlatformRoles vs
// seedTenantDefaultRoles below) — these exist only on roles with
// `tenant: null`.
export const PLATFORM_PERMISSIONS = {
  TENANTS: ["platform.tenants.read", "platform.tenants.manage", "platform.tenants.suspend"],
  BILLING: ["platform.billing.read", "platform.billing.manage"],
  SUPPORT: ["platform.support.impersonate"],
  ANALYTICS: ["platform.analytics.read"],
  FLAGS: ["platform.flags.manage"],
};
export const ALL_PLATFORM_PERMISSIONS = Object.values(PLATFORM_PERMISSIONS).flat();

// SUPER_ADMIN is a sentinel, not a stored permission list — it implicitly
// has every permission that exists today AND any added later, so a future
// permission never needs a migration to backfill onto the seeded
// SUPER_ADMIN role.
const SUPER_ADMIN = "SUPER_ADMIN";

// Phase 25 — these are now TENANT DEFAULT ROLE TEMPLATES: seeded once per
// tenant at provisioning time (tenantProvisioningService.js), not shared
// platform-wide rows. "SUPER_ADMIN" keeps its pre-Phase-25 name for
// backward compatibility with every existing seeded/test admin account,
// but within a tenant it means "this tenant's Owner", never platform
// access — platform-wide control is PLATFORM_DEFAULT_ROLES below.
export const DEFAULT_ROLES = [
  { name: SUPER_ADMIN, description: "Full tenant access, including this store's team/role management", permissions: [], isSystem: true },
  { name: "OWNER", description: "Full tenant access including billing, domains, and team management", permissions: [...ALL_PERMISSIONS.filter((p) => !p.startsWith("administration.")), ...PERMISSIONS.TEAM, ...PERMISSIONS.DOMAINS, ...PERMISSIONS.BILLING], isSystem: true },
  { name: "ADMIN", description: "Full commerce management, no billing/team/role management", permissions: ALL_PERMISSIONS.filter((p) => !p.startsWith("administration.")), isSystem: true },
  { name: "CATALOG_MANAGER", description: "Products, inventory, search", permissions: [...PERMISSIONS.PRODUCTS, ...PERMISSIONS.INVENTORY, ...PERMISSIONS.SEARCH], isSystem: true },
  { name: "INVENTORY_MANAGER", description: "Inventory only", permissions: PERMISSIONS.INVENTORY, isSystem: true },
  { name: "ORDER_MANAGER", description: "Orders and refunds", permissions: PERMISSIONS.ORDERS, isSystem: true },
  { name: "CUSTOMER_SUPPORT", description: "Read orders/customers, no financial actions", permissions: ["orders.read", "customers.read", "customers.update", "reviews.read"], isSystem: true },
  { name: "MARKETING_MANAGER", description: "Discounts, reviews, search merchandising", permissions: [...PERMISSIONS.DISCOUNTS, ...PERMISSIONS.REVIEWS, ...PERMISSIONS.SEARCH], isSystem: true },
  { name: "FINANCE_MANAGER", description: "Orders, refunds, analytics", permissions: [...PERMISSIONS.ORDERS, ...PERMISSIONS.ANALYTICS], isSystem: true },
  { name: "ANALYST", description: "Read-only analytics", permissions: ["analytics.read", "orders.read", "products.read", "customers.read"], isSystem: true },
  // Phase 15 — CMS roles. CONTENT_WRITER can create/edit but not publish
  // (rule #71); CONTENT_EDITOR adds publish; SEO_MANAGER is scoped
  // narrowly to SEO/redirects, not full content editing.
  { name: "CONTENT_WRITER", description: "Create and edit CMS content, cannot publish", permissions: ["cms.pages.read", "cms.pages.create", "cms.pages.update", "cms.blog.read", "cms.blog.create", "cms.blog.update", "cms.media.upload"], isSystem: true },
  { name: "CONTENT_EDITOR", description: "Full CMS content management including publishing", permissions: PERMISSIONS.CMS, isSystem: true },
  { name: "SEO_MANAGER", description: "SEO settings and redirects only", permissions: ["cms.pages.read", "cms.blog.read", "cms.seo.update", "cms.redirects.manage"], isSystem: true },
  // Phase 16 — Notifications roles. NOTIFICATIONS_MANAGER can configure
  // templates/providers/preferences but cannot fire a campaign; CAMPAIGN_MANAGER
  // adds campaign creation AND send.
  { name: "NOTIFICATIONS_MANAGER", description: "Manage templates, providers, preferences — cannot send campaigns", permissions: ["notifications.read", "notifications.templates.manage", "notifications.providers.manage", "notifications.analytics.read"], isSystem: true },
  { name: "CAMPAIGN_MANAGER", description: "Full notification and campaign management including sending", permissions: PERMISSIONS.NOTIFICATIONS, isSystem: true },
  // Phase 17 — Analytics. ANALYST (already existed since Phase 14) keeps
  // its narrower read-only scope; ANALYTICS_MANAGER adds export/reports/
  // rebuild for someone actually operating the analytics system.
  { name: "ANALYTICS_MANAGER", description: "Full analytics access including export, reports, and aggregate rebuild", permissions: PERMISSIONS.ANALYTICS, isSystem: true },
  // Phase 24 — Growth roles. GROWTH_ANALYST is read-only; GROWTH_MANAGER
  // adds the ability to manually adjust loyalty points, manage referrals,
  // and toggle feature flags — each of those is separately permissioned
  // above (rule #68), so a future narrower role can hold a subset.
  { name: "GROWTH_ANALYST", description: "Read-only growth/loyalty/referral visibility", permissions: ["growth.analytics.read", "growth.loyalty.read", "growth.referrals.read", "growth.flags.read"], isSystem: true },
  { name: "GROWTH_MANAGER", description: "Full growth feature management including loyalty adjustments and feature flags", permissions: PERMISSIONS.GROWTH, isSystem: true },
];

// Phase 25 (rule #19) — seeded ONCE, platform-wide (Role.tenant: null),
// completely separate from the tenant-role templates above. Deliberately
// has no "implicitly gets everything" sentinel the way tenant SUPER_ADMIN
// does — platform permissions are always checked explicitly (see
// hasPlatformPermission below) so a platform role can never accidentally
// reach into tenant-owned data via a bypass meant for a different scope.
export const PLATFORM_DEFAULT_ROLES = [
  { name: "PLATFORM_OWNER", description: "Full platform control", permissions: ALL_PLATFORM_PERMISSIONS, isSystem: true },
  { name: "PLATFORM_SUPER_ADMIN", description: "Full platform operations access", permissions: ALL_PLATFORM_PERMISSIONS, isSystem: true },
  { name: "PLATFORM_SUPPORT", description: "Read tenant data and impersonate for support, cannot change billing/plans", permissions: ["platform.tenants.read", "platform.support.impersonate"], isSystem: true },
  { name: "PLATFORM_BILLING_ADMIN", description: "Manage platform-wide SaaS billing", permissions: ["platform.tenants.read", ...PLATFORM_PERMISSIONS.BILLING], isSystem: true },
  { name: "PLATFORM_ANALYST", description: "Read-only platform analytics", permissions: ["platform.tenants.read", "platform.analytics.read"], isSystem: true },
];

export async function hasPermission(user, permission) {
  if (!user || user.role !== "admin") return false;
  if (!user.adminRole) return false;
  const role = user.adminRole.permissions ? user.adminRole : await User.populate(user, "adminRole").then((u) => u.adminRole);
  if (!role) return false;
  return role.name === SUPER_ADMIN || role.permissions.includes(permission);
}

// Phase 25 — the platform-scope counterpart to hasPermission above. Only
// ever consults roles where `tenant` is null; a tenant-scoped role (even
// one also named "SUPER_ADMIN" for a specific tenant) can never satisfy
// this check, because Role.tenant !== null for it.
export async function hasPlatformPermission(user, permission) {
  if (!user || user.role !== "admin") return false;
  if (!user.adminRole) return false;
  const role = user.adminRole.permissions ? user.adminRole : await User.populate(user, "adminRole").then((u) => u.adminRole);
  if (!role || role.tenant) return false;
  return role.permissions.includes(permission);
}

export function requirePlatformPermission(permission) {
  return async function (req, res, next) {
    const allowed = await hasPlatformPermission(req.user, permission);
    if (!allowed) return res.status(403).json({ message: "You don't have permission to do this", code: "PLATFORM_PERMISSION_DENIED" });
    next();
  };
}

// Phase 25 — permission check for a user's role WITHIN A SPECIFIC TENANT,
// via TenantMembership rather than the single global `User.adminRole` the
// pre-existing `hasPermission` above reads. Used by the NEW team/domain/
// billing endpoints this phase adds. NOTE (documented honestly, not
// silently glossed over): the 14 phases of existing admin controllers
// (products, orders, CMS, notifications, etc.) still authorize via
// `hasPermission`/`req.user.adminRole`, not this function — retrofitting
// every one of those call sites to check TenantMembership instead is a
// large, mechanical migration tracked as a P0 follow-up in
// docs/multi-tenant.md, not done in this pass (same change-minimization
// reasoning Phase 14 itself used when it layered RBAC on top of the
// coarse role field instead of rewriting every existing admin route).
export async function hasTenantPermission(user, tenant, permission) {
  if (!user || !tenant) return false;
  const TenantMembership = (await import("../models/TenantMembership.js")).default;
  const membership = await TenantMembership.findOne({ tenant: tenant._id || tenant, user: user._id || user, status: "active" }).populate("role");
  if (!membership || !membership.role) return false;
  return membership.role.permissions.includes(permission);
}

export function requireTenantPermission(permission) {
  return async function (req, res, next) {
    const allowed = await hasTenantPermission(req.user, req.tenant, permission);
    if (!allowed) return res.status(403).json({ message: "You don't have permission to do this", code: "TENANT_PERMISSION_DENIED" });
    next();
  };
}

// requirePermission("orders.refund") — the central authorization utility
// (rule #9) NEW admin endpoints use, layered after `protect` + `adminOnly`
// in the route chain, never replacing them.
export function requirePermission(permission) {
  return async function (req, res, next) {
    const allowed = await hasPermission(req.user, permission);
    if (!allowed) return res.status(403).json({ message: "You don't have permission to do this", code: "PERMISSION_DENIED" });
    next();
  };
}

export function isSuperAdmin(user) {
  return Boolean(user?.adminRole?.name === SUPER_ADMIN);
}

export { SUPER_ADMIN };
