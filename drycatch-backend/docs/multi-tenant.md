# Phase 25 — SaaS / Multi-Tenant Architecture

## Scope statement (read first)

This is an 80-model, single-tenant e-commerce backend built over 24 prior phases. The full spec for this phase — every one of its 88 numbered sections — describes a complete SaaS platform: custom domains with real SSL provisioning, a billing/subscription/entitlement engine, per-tenant CDN and search-index isolation, platform-wide impersonation and audit tooling, chaos/migration testing, theme architecture, and tenant-scoped retrofits of all 80 models and every route/queue/cache key touching them.

Building all of that for real, verified, in one pass is not something this session did, and claiming otherwise would violate the same honesty standard every phase since Phase 0 has held to (documented "N/A — single-tenant" notes, "no real queue exists," "no hosting target"). What follows is what was actually audited, decided, built, and verified — plus an explicit, prioritized roadmap for the rest, matching this project's established pattern of never faking completion.

## 1. Multi-Tenant Audit

A full audit was performed across all 80 models in `src/models/`, every route file, and every controller with an `findById(req.params...)`-style lookup. Summary of findings (full detail was produced during the audit and is condensed here):

- **Every commerce/content/analytics model is Tenant-owned.** Only a handful are genuinely platform-level: `FeatureFlag` (mixed — some platform-wide, some could become tenant-overridable), `WebhookEvent` and `NotificationEvent` (inbound processing queues, not tenant data themselves), and the new `Tenant`/`TenantDomain`/`TenantMembership`/platform `Role` rows.
- **User stays a platform-level identity.** Per the spec's own explicit design (§16 — "one user, multiple tenant memberships," not "one user, one tenant"), `User.email` remains globally unique. `TenantMembership` is the join model.
- **Critical unique indexes that break under multi-tenancy** (must become compound with `tenantId`): `Product.slug`, `Category.slug`, `Collection.slug`, `Coupon.code`, `ProductVariant.sku`, `ReferralCode.code`, `Page.slug`, `BlogPost.slug`, `Warehouse.code`, `InventoryLocation.code`, `NavigationMenu.name`, `Order.orderNumber`, `SearchSynonym.term`, `Redirect.source`, `Role.name`, all 8 `*DailyMetric` daily-rollup unique keys.
- **IDOR-pattern gaps found**: admin controllers that fetch by raw `req.params.id` and authorize purely via RBAC permission (never via ownership) will silently allow cross-tenant access once tenants exist. Found in `promotionController.js`, `roleController.js`, `adminReviewController.js`, `growthAdminController.js`, `notificationAdminController.js`. `orderController.js` already has the correct fetch-then-check pattern (verifies `order.user` before allowing a customer action) — this is the pattern every one of those needs, extended to also check `order.tenant`.
- **A real bug was found running the migration script** (not hypothetical): Mongo does not drop a stale single-field unique index just because a schema adds a compound one. `Product.slug_1` and `Role.name_1`'s pre-Phase-25 unique indexes were still live and would have silently defeated per-tenant slug/name reuse. `migrateAddTenantId.js` now drops them explicitly as a required step, verified by inspecting the live index list before and after.

## 2. Data Ownership — representative table

*(Full 80-row table was produced during audit; representative slice below — the pattern generalizes directly.)*

| Resource | Owner | Tenant-scoped? | Isolation method |
|---|---|---|---|
| Product | Tenant | Yes — **implemented** | `tenant` field + compound `(tenant, slug)` unique index |
| Category, Collection, Coupon, Page, BlogPost, Warehouse, ... | Tenant | Yes — **not yet migrated** | Same pattern as Product, documented as P0 follow-up |
| Order, Payment, Cart, Checkout | Tenant | Yes — **not yet migrated** | Direct `tenantId` field needed (audit: too high query-volume to derive via join) |
| User | Platform (shared identity) | No (memberships are) | `TenantMembership` join model |
| Role | Platform or Tenant | Both — **implemented** | `Role.tenant: null` = platform role; `Role.tenant: <id>` = that tenant's own role copy |
| Tenant, TenantDomain, TenantMembership | Platform | N/A | These ARE the platform's tenancy records |
| FeatureFlag | Platform (today) | No | Unchanged this phase — tenant-overridable flags are a documented P2 item |
| WebhookEvent, NotificationEvent | Platform | No | Inbound processing queues, not tenant data |

## 3. Tenancy Model Decision

**Selected: Option A — shared database, shared collections, strict `tenantId` scoping.**

- **Why**: this project runs on a single shared MongoDB instance with no ops/infra team, no Kubernetes, and no hosting target (established Phase 21) — schema-per-tenant or database-per-tenant would require operational tooling (per-tenant migrations, per-tenant connection pooling/routing) this project has no infrastructure to run. Shared-collections-with-`tenantId` is also what the spec itself recommends by default (§5) absent a real requirement for stronger isolation.
- **Advantages**: no per-tenant schema/database provisioning step, works with the existing Mongoose connection model unchanged, scales via indexing (proven pattern to 10k+ tenants at companies like Slack/GitHub-style multi-tenant SaaS).
- **Risks**: a missed `tenantId` filter in any one query is a real cross-tenant data leak — this is why the IDOR-pattern audit above matters, and why `requireTenant` resolves tenant identity server-side (never from a client-suppliable field) rather than relying on developer discipline per query.
- **Migration impact**: additive (`tenantId` nullable during transition) rather than a hard schema break — proven with the real `migrateAddTenantId.js` run against this project's own dev database.
- **Scaling limits**: shared collections with proper compound indexes handle the stated 10 → 10,000 tenant range without a rewrite; a genuinely huge single tenant (dedicated infrastructure, §85 P4) would be the actual future trigger for schema/database-per-tenant, not default behavior.

## 4. What Was Actually Built (verified)

**Core tenancy foundation (all new, all real):**
- `Tenant` model — lifecycle status (`trialing/active/suspended/past_due/cancelled/deletion_requested/deleted`), plan, categorized settings (branding/commerce/seo/growth, not a raw JSON blob per rule #24), onboarding-state tracking.
- `TenantDomain` model — subdomain + custom domain support, real DNS TXT verification (`dns.resolveTxt`, not a client-trust shortcut), primary-domain enforcement (`setPrimaryDomain` atomically demotes the old one).
- `TenantMembership` model — one user, many tenants, each with its own role; invite/accept/revoke flow with expiring tokens and duplicate-invite prevention (DB-level partial unique indexes).
- `Role` model extended with a nullable `tenant` field — the SAME collection now serves both platform roles (`tenant: null`) and tenant-scoped roles, distinguished structurally, not by convention.
- **Tenant resolution middleware** (`tenantContext.js`) — resolves from custom domain first, then platform subdomain; `requireTenant` rejects unknown/suspended/cancelled tenants outright; `resolveTenantOptional` attaches tenant context for logging without blocking ambiguous routes (auth, platform admin). Neither ever reads a tenant identifier from the request body — resolution is 100% server-side from the Host header, per rule #10.
- **Tenant-aware logging**: `requestContext.js`/`logger.js` extended so every structured log line includes `tenantId` alongside the existing `requestId`, via the same `AsyncLocalStorage` pattern Phase 22 established.
- **RBAC boundary**: `hasPlatformPermission`/`requirePlatformPermission` are structurally separate from `hasPermission` (tenant-role, sentinel-based) and the new `hasTenantPermission`/`requireTenantPermission` (membership-based) — a platform role can never satisfy a tenant permission check or vice versa (rule #19/#20), verified in tests.
- **Reserved-slug validation** (`tenantSlug.js`) — blocks `admin`, `api`, `www`, `checkout`, etc., plus format/length rules.
- **Tenant provisioning** (`tenantProvisioningService.js`) — idempotent pipeline: create tenant → create default subdomain → seed tenant's own copy of every default role → create Owner membership. `ensureDefaultTenant()` is the migration-safety anchor every pre-Phase-25 record gets assigned to.
- **Self-service tenant API** (`/api/v1/tenant/*`) — settings, team invite/accept/revoke, domain add/verify/set-primary/remove — all gated by `requireTenantPermission`, never by a client-supplied tenant ID.
- **Platform admin API** (`/api/v1/platform/admin/*`) — separate router tree, gated by `requirePlatformPermission`, structurally unreachable by any tenant role: list/create/suspend/reactivate tenants, request deletion (retention-window, not immediate delete — rule #57).

**One complete, real, end-to-end tenant-scoped resource (proof of pattern): Product.**
- `Product.tenant` field + compound `(tenant, slug)` unique index (old global-unique `slug` index found and dropped — see the real bug above).
- `productService.listProducts/getPublicProductByIdOrSlug/createProduct/updateProduct` all accept an optional `tenantId`, always sourced from `req.tenant` (never `req.body`/`req.query`), fully backward-compatible when omitted (every pre-Phase-25 caller still works unchanged — verified by the full existing suite still passing).
- `updateProduct` added a fetch-then-check tenant-ownership guard, mirroring the exact pattern `orderController.js` already used for user-ownership (rule #63).
- Migration script (`scripts/migrateAddTenantId.js`) — actually run against this project's dev database: dropped the two stale global-unique indexes, created/confirmed the default tenant, backfilled (0 products existed to migrate, but the backfill/validation logic ran for real and reported correctly), and is idempotent (re-run produces the same clean state).

**Verification performed (not claimed):**
- `node --check` across the full `src` tree — clean.
- 13 new tests (`tests/integration/multiTenant.test.js`): reserved-slug rejection, tenant provisioning (with duplicate/reserved-slug rejection), membership invite/accept/duplicate-prevention, and — the core proof — **two tenants creating products with the identical slug without colliding**, **tenant A's product listing excluding tenant B's products**, **a slug lookup scoped to tenant A never returning tenant B's product**, and **tenant A being refused when attempting to update tenant B's product** (the actual cross-tenant security test rule #62 asks for). Full suite: **121/121 passing** (108 pre-existing + 13 new).
- Live server boot — clean, with platform roles and the default tenant seeded on startup.
- Live migration script run against the real dev database, including catching and fixing the stale-index bug in the process.

## 5. Explicitly NOT Done (P1–P4 roadmap)

Everything below is real, scoped, unimplemented work — not filler. Priorities mirror the spec's own §85 structure.

**P0 — remaining core multi-tenancy (highest priority, blocks everything else):**
- Retrofit the other ~79 models per the ownership table (Category, Order, Cart, Payment, Coupon, CMS content, analytics rollups, etc.) — each needs the same `tenant` field + compound index + service/controller scoping Product just got, times ~79.
- Retrofit `hasPermission`/existing admin controllers (14 phases' worth) from `user.adminRole` (single global role) to `TenantMembership`-based checks — today only the NEW Phase 25 endpoints use `hasTenantPermission`; every pre-existing admin route (products, orders, CMS, notifications, growth, etc.) still authorizes via the old single-tenant-shaped RBAC and needs this migration to be genuinely tenant-safe.
- Fix the 5 concrete IDOR gaps found in the audit (promotionController, roleController, adminReviewController, growthAdminController, notificationAdminController).
- Apply the same migration-script pattern (with stale-index audit) to every retrofitted model.

**P1 — store management:**
- Tenant onboarding wizard/state machine beyond the `onboarding` sub-schema already on the `Tenant` model (fields exist, no UI/flow orchestration built).
- Tenant branding actually applied to the storefront (fields exist on `Tenant.settings.branding`, no frontend theming/consumption built).
- SSL/HTTPS provisioning for custom domains (rule #32) — this needs real infrastructure (ACME/Let's Encrypt + a reverse proxy/CDN) this project doesn't have, same "no hosting target" gap Phase 21 already documented. DNS TXT verification is real; certificate issuance is not.

**P2 — SaaS monetization (entirely unbuilt):**
- Plan/entitlement/usage-metering/billing-webhook/upgrade-downgrade/billing-portal system. `Tenant.plan` is a bare enum field today with no entitlement service consulting it anywhere — every "does this tenant's plan allow X" check described in §48 does not exist. This is the single largest remaining body of work in the spec and was not attempted this session.

**P3 — platform operations:**
- Support impersonation, tenant data export, tenant audit log (a dedicated one — `AdminAuditLog` exists but isn't tenant-scoped yet), noisy-neighbor protection, per-tenant rate limiting/quotas, per-tenant observability dashboards (Phase 22's metrics are not yet tenant-labeled).

**P4 — advanced platform:**
- Theme architecture, multi-tenant search index isolation (today's single `ProductSearchIndex` collection has no `tenant` field), multi-tenant CDN/cache-key isolation, chaos/migration testing at scale, dedicated infrastructure options.

## 6. Scorecard

| Area | Score | Note |
|---|---|---|
| Tenant Architecture | 7/10 | Decision made and justified; core models real |
| Tenant Resolution | 8/10 | Real host-based resolution, server-side only |
| Data Isolation | 2/10 | 1 of ~80 tenant-owned models actually retrofitted |
| Database Design | 6/10 | Pattern proven (Product); not applied platform-wide |
| Query Safety | 3/10 | Only Product's service functions are tenant-safe |
| Cross-Tenant Security | 3/10 | Verified for Product only; 5 known IDOR gaps elsewhere, documented not fixed |
| User Membership | 8/10 | Real invite/accept/revoke, multi-tenant-per-user |
| RBAC | 7/10 | Platform/tenant boundary structurally enforced; existing 14-phase admin RBAC not yet migrated to it |
| Onboarding | 3/10 | State fields exist, no flow |
| Tenant Settings | 6/10 | Categorized schema exists and is updatable |
| Branding | 3/10 | Fields exist, not consumed anywhere |
| Domain Management | 6/10 | Real DNS verification; no SSL provisioning (no infra) |
| Cache Isolation | 1/10 | Not addressed this session |
| Media Isolation | 0/10 | Not addressed this session |
| Search Isolation | 0/10 | Not addressed this session |
| Analytics Isolation | 0/10 | Not addressed this session |
| Queue Isolation | N/A | No real queue exists in this project (established Phase 16) |
| Webhook Isolation | 0/10 | Not addressed this session |
| SaaS Billing | 0/10 | Not built |
| Plans & Entitlements | 1/10 | Bare enum field only |
| Usage Metering | 0/10 | Not built |
| Rate Limiting (per-tenant) | 0/10 | Existing rate limits are global, not tenant-aware |
| Noisy Neighbor Protection | 0/10 | Not addressed |
| Tenant Observability | 2/10 | Logs are tenant-labeled; metrics/dashboards are not |
| Provisioning | 7/10 | Real, idempotent, tested |
| Migration Safety | 7/10 | Real script, actually run, caught a real bug |
| Testing | 6/10 | 13 real tests for what was built; no coverage for the ~79 unmigrated models |

**Overall: 3.8/10 against the full 88-section spec — a genuine, verified foundation (tenant model, resolution, membership, RBAC boundary, one fully-proven end-to-end resource) with the majority of the platform (billing, full data isolation, SSL, per-tenant observability) honestly on the roadmap rather than faked.**
