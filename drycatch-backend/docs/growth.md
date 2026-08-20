# Phase 24 — Growth Features

## Audit Table

| Area | Status | Notes |
|---|---|---|
| Recently viewed | PRODUCTION READY | Per-user and per-guest, upsert + trim, merges into user list is NOT wired at login (see Deferred) |
| Related products | ADEQUATE | Category/tag heuristic, no ML/embedding-based similarity |
| Frequently bought together | ADEQUATE | Real co-occurrence aggregation over `Order.items`, min-2 threshold, 10-min cache |
| Reorder / "Buy Again" | PRODUCTION READY | Preview-then-commit, re-validates price/stock/product-existence per item at both stages |
| Back-in-stock alerts | PRODUCTION READY | Closes Phase 16's own documented gap (event had no per-user targeting) |
| Price-drop alerts | PRODUCTION READY | Wired into `variantService.updateVariant`'s default-variant price path |
| Abandoned cart recovery | PRODUCTION READY (admin-triggered) | Wires a Phase 16 event type that was defined but never published; no scheduler exists (N/A, see below) |
| Feature flags | PRODUCTION READY | Kill switch + stable percentage rollout via SHA-256 bucketing, no external LaunchDarkly-style targeting rules |
| Loyalty points | PRODUCTION READY | Immutable ledger, balance always derived, idempotent earn, proportional refund reversal |
| Referral program | PRODUCTION READY | Stable per-user code, self-referral blocked, first-order-only qualification |
| A/B testing / experimentation platform | NOT IMPLEMENTED | See Deferred |
| Segmentation / segment builder | NOT IMPLEMENTED | See Deferred |
| Gift cards / store credit | NOT IMPLEMENTED | See Deferred |
| Bundles | NOT IMPLEMENTED | See Deferred |
| Multi-tenant isolation | N/A | Single-tenant project (established Phase 0) |
| CLV / cohorts / retention | Covered by Phase 17 | Not duplicated here — see `docs/analytics.md` |

## Architecture

All growth features are additive services under `src/services/growth/`, reusing existing infrastructure rather than building parallel systems:

- **Event bus** (`services/notifications/eventBus.js`, Phase 16) is the backbone. `growthEngine.js` and `stockAlertService.js` subscribe to `ORDER_DELIVERED`, `REFUND_COMPLETED`, `ORDER_CONFIRMED`, `BACK_IN_STOCK`, `PRICE_DROPPED` — no new call sites were added into order/payment/variant services beyond the two documented below.
- **No real job scheduler exists in this project** (established Phase 16). Abandoned-cart recovery is therefore admin-triggered (`POST /admin/growth/abandoned-cart/sweep`), the same honest pattern as every other "scheduled" feature since Phase 16 — not faked as automatic.
- **Immutable ledger pattern**: `LoyaltyLedgerEntry` rows are never mutated or deleted; `getBalance()` is always a live aggregation sum, mirroring this project's existing Payment/Refund non-mutation philosophy.
- **Stable bucketing, not stored assignments**: feature flags hash `flagKey:subjectId` (SHA-256) instead of persisting a per-user assignment row, so rollout percentage changes apply instantly without a migration.

## What Was Built (with verification evidence)

**Backend**: 8 new models, 8 new growth services, 1 event-subscriber registration module, 2 controllers (customer + admin), 2 route files, plus targeted edits to `variantService.js` (price-drop detection), `authController.js`/`User.js` (referral attribution through signup+OTP), `rbac.js` (2 new roles, 9 new permissions), `app.js` (wiring).

Verification:
- `node --check` across the full `src` tree — all files syntactically valid.
- 17 new tests added (`tests/integration/growth.test.js`) covering loyalty idempotency/redemption/reversal math, referral self-referral/double-attribution/first-order-qualification rules, and feature-flag kill-switch/rollout/stable-bucketing behavior. Full suite: **108/108 passing**.
- Fixed a real latent bug surfaced by these tests: the shared test harness (`tests/helpers/testDb.js`) didn't wait for Mongoose's background index builds after reconnect, so a unique-index-dependent test (loyalty idempotency) could race ahead of the index existing and silently allow a duplicate. Fixed by awaiting `Model.init()` for every registered model in `startTestDb()` — this was a bug in the test infrastructure itself, not just this phase's code, and now protects every future test file that relies on a unique index.
- Live curl verification against a running server with real data: signup → OTP verify → referral code generation → referral attribution → order → qualification → loyalty reward; admin flag CRUD → customer-side flag check; admin loyalty adjustment → reflected in customer's own balance; stock-alert subscribe → listed; abandoned-cart sweep → correctly found and evaluated real cart candidates.

**Frontend**: `growthAPI` in `src/utils/api.js`; `ProductRecommendations`, `StockAlertButton`, `ReorderButton` components; wired into `productDetails.jsx` (view tracking, related/FBT rails, stock-alert button on out-of-stock) and `orderDetail.jsx` (Buy Again); new account pages `Loyalty.jsx`/`Referrals.jsx` wired into `AccountRoute.jsx`/`AccountSidebar.jsx`; `signup.jsx` captures `?ref=CODE` and threads it through signup/resend. Verified via `npm run build` (clean) and `eslint` (zero new warnings/errors — pre-existing lint issues in `orderDetail.jsx`/`productDetails.jsx` confirmed via `git stash` to predate this phase).

## Explicitly NOT Done (and why)

- **A/B testing / experimentation platform**: feature flags provide the primitive (stable bucketing), but no experiment-definition UI, no statistical significance calculation, no variant-level analytics tie-in exists. Building a real experimentation platform is a project of its own scale; out of scope here.
- **Segmentation / segment builder**: no customer-segment query builder or saved-segment UI exists. Phase 17's analytics already provides cohort/retention breakdowns; a full drag-and-drop segment builder was not built.
- **Gift cards / store credit**: no model or redemption flow exists. Loyalty points serve an adjacent purpose (earn-and-redeem) but are not a general-purpose store-credit ledger for arbitrary top-ups/refund-to-credit.
- **Bundles**: no "buy these together at a discount" bundle/kit model exists; FBT surfaces the *insight* (what's bought together) but doesn't let admins configure a priced bundle from it.
- **Personalization beyond recommendations**: no personalized homepage, personalized email content generation, or dynamic pricing per segment.
- **CLV/cohorts/retention**: intentionally not duplicated — Phase 17 (`docs/analytics.md`) already owns this.
- **Multi-tenant referral/loyalty isolation**: N/A, single-tenant project.
- **Anonymous → user merge for recently-viewed at login**: the service function `mergeAnonymousIntoUser` exists and was verified in isolation, but is not yet called from the frontend login flow (no guest-cart-merge-style hook exists on the frontend to piggyback on — confirmed via audit). Deferred rather than left silently broken; documented here as a known gap.

## Scorecard

1. Recently viewed — 9/10 (merge-on-login not wired)
2. Related products — 7/10 (heuristic, not ML-based)
3. Frequently bought together — 8/10 (real aggregation, capped cache window)
4. Reorder — 9/10
5. Stock alerts (back-in-stock + price-drop) — 9/10
6. Abandoned cart recovery — 8/10 (admin-triggered, not real-time)
7. Feature flags — 8/10 (no advanced targeting rules beyond percentage rollout)
8. Loyalty program — 9/10
9. Referral program — 9/10
10. Frontend integration — 8/10 (functional, not pixel-polished; no dedicated design pass)

**Overall: 8.4/10 — production-ready core growth loop, explicitly missing an experimentation platform, segmentation, and gift cards/bundles, all documented above rather than faked.**
