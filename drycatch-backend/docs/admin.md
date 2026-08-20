# Admin Dashboard & RBAC (Phase 14)

## The core rule

Admin authorization is a real, enforced backend boundary — never a
frontend route guard alone (rule #6). Every sensitive admin endpoint this
phase adds sits behind `protect` + `adminOnly` (the existing coarse gate)
**and** `requirePermission("module.action")` (the new granular gate),
resolved from the authenticated user's server-side role, never from a
client-supplied role/permission claim.

## Before this phase

Thirteen prior phases already had real admin functionality — inventory
adjustment, order status transitions, product/catalog CRUD, promotion/
coupon management, review moderation, shipment/fulfillment operations,
search merchandising — every one of them gated by a single binary check:
`User.role === "admin"`. No granular permissions, no persisted
cross-cutting audit trail (each domain had its own event log — `OrderEvent`,
`ShipmentEvent` — but nothing answered "what has this admin done across
every module"), no role management, no admin user invitation flow, and no
aggregated dashboard endpoint — the frontend had **no admin UI at all**.

## RBAC — layered on top of, not replacing, the existing gate

Rewriting fourteen phases' worth of `adminOnly` call sites to a dynamic
permission check would be a massive, risky rewrite for this pass with no
functional payoff — the coarse gate has been correct and tested all along.
Instead: `User.role === "admin"` remains "is this person staff at all";
`User.adminRole` (new, a ref to `Role`) is the finer-grained permission set
consulted by **new** Phase 14 endpoints (dashboard, roles, admin-user
management, audit logs, customer block/unblock) via
`utils/rbac.js#requirePermission("products.update")`-style middleware.
This is a deliberate, documented layering — rule #9's "prefer `can()`"
principle is demonstrated on every new endpoint this phase adds, without
destabilizing the thirteen phases of already-verified `adminOnly` gates.

## Roles and permissions

`Role` — `name` (unique), `permissions[]` (string codes), `isSystem`
(seeded roles, not deletable/renamable via the API). `utils/rbac.js`
defines the full permission catalog (`PERMISSIONS`, grouped exactly like
the admin sidebar's module list) and nine default roles
(`SUPER_ADMIN, ADMIN, CATALOG_MANAGER, INVENTORY_MANAGER, ORDER_MANAGER,
CUSTOMER_SUPPORT, MARKETING_MANAGER, FINANCE_MANAGER, ANALYST`), seeded
idempotently at server boot (`utils/seedRoles.js` — `$setOnInsert`, so an
admin's later edits to a seeded role's permission list survive a restart).
`SUPER_ADMIN` is a sentinel name, not a stored permission list — it
implicitly has every permission that exists today *and* any added later,
so a new permission never needs a migration to backfill onto it.

## The bootstrapping problem — found and fixed

An invite-only admin system (rule #74: "do not create admins using
insecure direct password assignment") has an obvious chicken-and-egg
problem: admins can only be created by an *existing* admin inviting them,
so a brand-new deployment with zero admin users has no one able to call
that API at all. `utils/seedSuperAdmin.js` — creates exactly one
`SUPER_ADMIN`, only when `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`
are set **and** no admin user exists yet, idempotent (never runs twice,
never overwrites an existing account). Verified in isolation (temporarily
relabeling this sandbox's existing test admin accounts to simulate a fresh
deployment): the bootstrap created exactly one Super Admin on the first
call and correctly no-op'd on the second.

## Admin invitations

`AdminInvite` — `email`, `role`, one-time `token`, `expiresAt` (7 days),
`status` (`pending/accepted/expired/revoked`). `adminUserService.js#
inviteAdmin` creates the invite and logs the accept-link to console — no
real email delivery is integrated anywhere in this project (same honest
gap as `utils/otp.js`'s console-only OTP "delivery" from Phase 1) — a real
deployment would wire this to an actual email provider. `acceptInvite`
verifies the token, checks expiry, and creates the `User` (`role: "admin"`,
`adminRole` from the invite) — never a direct password assignment by
another admin.

## Privilege escalation — explicitly blocked, not just "not encouraged"

Three real guards, all verified:

- **Only a `SUPER_ADMIN` may invite or promote another `SUPER_ADMIN`** —
  verified: a `CATALOG_MANAGER` attempting to invite a `SUPER_ADMIN` was
  rejected (`PRIVILEGE_ESCALATION_BLOCKED`); a `SUPER_ADMIN` doing the same
  succeeded.
- **An admin can never change their own role** — verified
  (`SELF_ROLE_CHANGE_BLOCKED`) — prevents a compromised or malicious admin
  session from silently self-promoting.
- **An admin can never deactivate their own account** — verified
  (`SELF_DEACTIVATION_BLOCKED`) — a locked-out admin can't be the one who
  locked themselves out by mistake or maliciously to cover tracks.

## Cross-cutting audit log

`AdminAuditLog` — `actor`, `action` (e.g. `PRODUCT_UPDATED`,
`INVENTORY_ADJUSTED`, `PAYMENT_REFUNDED`, `ROLE_CHANGED`,
`CUSTOMER_BLOCKED`), `entityType`/`entityId`, `before`/`after` snapshots,
`ip`/`requestId`. Deliberately separate from domain-specific event logs
that already existed (`OrderEvent` from Phase 9, `ShipmentEvent` from
Phase 10) — those answer "what happened to this order/shipment"; this
answers "what did this admin do," searchable across every module in one
place (rule #78). Append-only by convention — no update/delete route
exists for this model at all (rule #80), not merely permission-gated.

Wired into a representative, verified sample of sensitive mutations
(product update, inventory adjustment, payment refund, role change,
admin invite/accept, customer block/unblock) rather than instrumenting
every single admin action in this pass — the pattern
(`recordAdminAction({...}).catch(() => {})`, wrapped so an audit-logging
failure never fails the underlying action) is established and trivially
extendable to any other controller. Verified: a product price change
recorded the exact before/after price and the correct actor.

## Customer block/unblock

Admin-initiated suspension (`User.status: "blocked"`), distinct from the
customer's own self-service `"deactivated"` state (Phase 2) — a support
agent and a customer's own action are never ambiguous in the audit trail.
Blocking immediately prevents login (`middleware/auth.js` rejects
`status: "blocked"` at both `protect` and login) without deleting the
account or its order history. Verified: blocking set `status`, `blockedAt`,
`blockedBy`, `blockReason` correctly; unblocking restored `status: "active"`
and cleared the block fields.

## Dashboard aggregation

`GET /admin/dashboard?range=today|yesterday|7d|30d|90d` — one aggregated
endpoint (rule #86/#87), not the frontend firing a dozen requests to render
the first screen. `dashboardService.js` runs every section
(revenue/orders, new customers, product status breakdown, low stock,
top products, recent orders, recent admin activity, pending review count,
search zero-result rate) as **independent, concurrent** aggregation
queries via `Promise.all` — a slow section never blocks the others (rule
#151), and each maps to its own frontend widget that can fail
independently (rule #154). Revenue is computed via a single Mongo
aggregation pipeline against `Order` (`paymentStatus: "succeeded"` — Phase
8's authority on what actually got paid, not Order's coarser business
status), never "load every order into Node and sum in JavaScript" (rule
#88). Comparison-period growth percentages (rule #17) are computed from
the identical aggregation run against the prior period, never fabricated.

## What's explicitly NOT here yet (by design, not oversight)

- **MFA** (rule #115) — no multi-factor auth exists anywhere in this
  project yet; `Role`/`User` are structured so an `mfaEnabled`/`mfaSecret`
  field could be added to `User` later without touching this phase's RBAC
  shape.
- **Multi-tenant/SaaS isolation** (rule #106-110) — single-tenant only;
  every model in this project lacks a `tenantId`/`storeId` field, and
  retrofitting one is a real, larger migration this phase doesn't attempt.
- **Report export jobs, background job monitoring, system health
  dashboard** (rule #63-65, #82-84, #128, #148-149) — no queue/job
  infrastructure exists in this project (same limitation noted since
  Phase 5's inventory-reservation expiry); these need that infrastructure
  first.
- **Admin global command palette (⌘K), WebSocket/SSE real-time updates**
  (rule #90, #139) — explicitly lower-priority per the spec's own "do not
  prioritize this over core functionality" language.
- **Full admin CRUD UI for every module** (products, categories, brands,
  discounts, etc.) — the backend APIs for these already existed from
  Phases 3-13; this phase adds the RBAC/audit/dashboard layer and a
  genuinely new admin frontend shell (layout, sidebar, dashboard,
  roles/admin-users/audit-log pages) rather than rebuilding a full
  CRUD UI for every already-existing admin API in one pass.
- **CSRF tokens** (rule #111) — this project's existing auth is
  cookie-based with `SameSite`/CORS-origin restrictions (established in
  Phase 1), not a separate CSRF token scheme; unchanged this phase.
