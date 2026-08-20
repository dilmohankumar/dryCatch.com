# API

Base URL: `/api/v1`. All bodies are JSON. Authenticated routes rely on the
`access_token` httpOnly cookie (set automatically by login/signup/refresh);
a `Bearer <token>` header also works for non-browser clients.

| Prefix | Router | Notes |
|---|---|---|
| `/auth` | `authRoutes.js` | signup, OTP verify, login, password reset, refresh, `/me`, profile, change-password, deactivate, sessions/revoke-others, logout |
| `/addresses` | `addressRoutes.js` | authenticated CRUD + `/default` (shipping/billing independently), ownership enforced via `req.user._id` |
| `/preferences` | `preferencesRoutes.js` | authenticated get (auto-creates)/update marketing & alert preferences |
| `/products` | `productRoutes.js` | public list (paginated envelope, whitelisted filters)/detail (id or slug)/featured/by-category; admin create/update/archive |
| `/categories` | `categoryRoutes.js` | public list/tree/detail (id or slug, includes breadcrumb)/; admin create/update/delete (blocked if in use) |
| `/collections` | `collectionRoutes.js` | public list/detail by slug; admin create/update/delete (blocked if in use) |
| `/cart` | `cartRoutes.js` | guest OR authenticated (identity via cookie): get/add-item/set-item-quantity/remove-item/clear |
| `/wishlist` | `wishlistRoutes.js` | authenticated: get/add/remove/clear |
| `/orders` | `orderRoutes.js` | authenticated: create (reserves stock, `Idempotency-Key` supported)/verify/retry-payment/payment-status/get-mine (paginated)/get-by-id/get-timeline/cancel (policy-gated, releases or returns stock); admin: list-all (paginated)/update-status (state-machine validated) |
| `/products/:productId/reviews` | `productReviewRoutes.js` | public list/summary; authenticated+rate-limited create (Phase 12) |
| `/reviews` | `reviewRoutes.js` | authenticated my-reviews/update/delete/vote/report; `GET /:id` optionally-authenticated (Phase 12) |
| `/admin/reviews`, `/admin/review-reports` | `adminReviewRoutes.js` | admin-only moderation queue and report queue (Phase 12) |
| `/admin/inventory` | `inventoryRoutes.js` | admin-only: list/detail/adjust/receive/movements |
| `/checkout` | `checkoutRoutes.js` | authenticated only (no guest checkout): create from cart, get, validate, address/shipping/coupon steps, place-order |
| `/payments` | `paymentRoutes.js` | `POST /webhook/:provider` — no auth, provider-agnostic URL (Razorpay only actually works), verified by HMAC signature; `POST /:paymentId/refund` — admin-only |
| `/shipments` | `shipmentRoutes.js` | authenticated: get/tracking (ownership via shipment's order) |
| `/admin/warehouses` | `warehouseRoutes.js` | admin-only: list/create |
| `/admin/fulfillments` | `fulfillmentRoutes.js` | admin-only: create/list/get/allocate/pick/pack/ready |
| `/admin/shipments` | `adminShipmentRoutes.js` | admin-only: create/list/label/cancel/poll |
| `/shipping` | `shippingWebhookRoutes.js` | `POST /webhooks/:carrier` — no auth, carrier-agnostic URL, HMAC-verified |
| `/search` | `searchRoutes.js` | public, rate-limited, optionalAuth: main search, autocomplete, suggestions, click tracking (Phase 13) |
| `/admin/search` | `adminSearchRoutes.js` | admin-only: synonyms/rules CRUD, reindex, reconcile, health, analytics (Phase 13) |
| `/admin/dashboard` | `adminDashboardRoutes.js` | admin + `requirePermission` (RBAC): aggregated dashboard KPIs (Phase 14) |
| `/admin/roles` | `roleRoutes.js` | admin + `requirePermission`: role CRUD, seeded roles protected (Phase 14) |
| `/admin/admin-users` | `adminUserRoutes.js` | accept-invite is no-auth (token-based); rest admin + `requirePermission`: invite/list/role-change/deactivate (Phase 14) |
| `/admin/customers` | `adminCustomerRoutes.js` | admin + `requirePermission`: customer list/block/unblock (Phase 14) |
| `/admin/audit-logs` | `auditLogRoutes.js` | admin + `requirePermission`: read-only, append-only cross-cutting audit trail (Phase 14) |
| `/content` | `contentRoutes.js` | fully public, no auth: homepage/pages/blog/faqs/navigation/footer/banners, published-only (Phase 15) |
| `/admin/cms/pages` | `cmsPageRoutes.js` | admin + `requirePermission`: page lifecycle (draft→...→published/archived), revisions (Phase 15) |
| `/admin/cms/blog` | `cmsBlogRoutes.js` | admin + `requirePermission`: same lifecycle shape as pages (Phase 15) |
| `/admin/cms` | `cmsRoutes.js` | admin + `requirePermission`: media, navigation, footer, FAQs, banners, redirects, SEO settings (Phase 15) |

`GET /health` — liveness check, no dependencies.
`GET /ready` — readiness check, verifies MongoDB connection state.

## Response shape

Most success responses are still resource-keyed JSON, e.g. `{ product }`,
`{ order }` — there is no single envelope across the whole API yet (would
require touching every controller and the frontend's parsing simultaneously).

**Exception:** `GET /products` (the catalog listing endpoint) uses the
`{ success: true, data: { items, pagination } }` envelope, since this pass
rewired both sides of that endpoint anyway — see `docs/api.md#catalog`
below. Other endpoints keep their existing shape until a dedicated pass
does the same for the whole API.

Error responses: `{ message: string }`, with an appropriate HTTP status
code. Raw MongoDB/Mongoose errors (duplicate key, cast errors, validation
errors) are translated to clean customer-safe messages centrally in
`middleware/errorHandler.js` — never leaked verbatim.

## Catalog

`GET /products` whitelisted query params: `category` (slug or comma-list),
`collection` (slug or comma-list), `tag` (comma-list), `origin` (originType,
comma-list), `minPrice`, `maxPrice`, `search`, `featured`, `sort` (one of
`featured`, `newest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`,
`popularity`, `discount_desc`), `page`, `limit` (capped at 100). Nothing
from `req.query` reaches MongoDB directly — unrecognized params are ignored,
not passed through.

Public catalog endpoints only ever return `status: "active"` +
`visibility: "public"` products/active categories/active collections.
Product IDs and slugs are both valid in `GET /products/:idOrSlug` and
`GET /categories/:idOrSlug`.

Admin catalog writes (`POST/PUT /products`, `POST/PATCH /categories`,
`POST/PATCH /collections`) use an explicit field allowlist
(`services/productService.js` / `categoryService.js` / `collectionService.js`)
— `req.body` is never spread directly into a Mongoose write.

## Variants

Product is not the purchasable SKU — `ProductVariant` is (see
`docs/database.md`). Nested under products:

```
GET    /products/:productId/variants            — public, active+public only, customer-safe shape
GET    /products/:productId/variants/:variantId
GET    /products/:productId/variants/admin       — admin, all statuses
POST   /products/:productId/variants             — admin
PATCH  /products/:productId/variants/:variantId  — admin
DELETE /products/:productId/variants/:variantId  — admin, archives (never hard-deletes)
```

`sku` is settable only at creation (auto-generated from the product name +
weight if omitted) and immutable afterward — a variant that needs a new SKU
is archived and recreated, not edited in place, so a SKU that already
appeared in a cart/order never silently changes meaning. Duplicate
attribute combinations for the same product (e.g. two "500g" variants) are
rejected via a DB-level unique index, not just app-level checking — see
`services/variantService.js#computeCombinationKey`.

`Order.items[]` carries an optional `variant` reference alongside `product`
— when a specific variant is selected, it's what actually gets priced and
snapshotted, not `Product.price`. Cart (Phase 6, below) now requires a
variant on every line — see `docs/cart.md`.

## Inventory (Phase 5) — see `docs/inventory.md` for the full flow

Customer-facing, nested under variants:
```
GET /products/:productId/variants/:variantId/availability
  → { available: boolean, status: "in_stock"|"low_stock"|"out_of_stock" }
```
Never exposes on-hand/reserved counts or warehouse data.

Admin-only, mounted at `/api/v1/admin/inventory`:
```
GET  /                → list (search by sku/product name, paginated)
GET  /movements        → movement ledger (filter by variantId or sku)
GET  /:variantId       → on-hand/reserved/available/status for one variant
POST /adjust           → { variantId, delta, reason }  — reason is mandatory
POST /receive          → { variantId, quantity, reason }
```

`POST /orders` now reserves stock for every item that names a `variant`
before creating the Razorpay order, and rolls the reservation back (and
deletes the pending order row) if either the reservation or the Razorpay
call fails — a customer is never left holding a reservation for an order
that never actually started. `POST /orders/verify` commits the reservation
(permanent deduction) on successful payment; `PUT /orders/:id/cancel`
releases it if the order was still pending, or records a `RETURN` movement
if it had already been paid.

## Cart (Phase 6) — see `docs/cart.md` for the full architecture

```
GET    /cart                — works for guests (httpOnly guest-cart cookie) and logged-in users alike
POST   /cart/items           — { variantId, quantity } — ADDS to existing quantity
PATCH  /cart/items/:itemId   — { quantity } — SETS the absolute quantity
DELETE /cart/items/:itemId
DELETE /cart
```

Response: `{ success: true, data: { cartId, items, summary } }`. Every
item is enriched from live catalog/inventory data (name, image, current
unit price, per-line subtotal, availability) and `summary.subtotal`/`total`
are computed server-side in integer paise, then converted back — the
frontend never submits or trusts a price/total, only `{variantId, quantity}`.

On login/signup-verify, any active guest cart is merged into the user's
cart (idempotent — a retried login doesn't double the quantities), capped
per line at current available stock rather than silently producing an
unpurchasable line.

## Checkout (Phase 7) — see `docs/checkout.md` for the full architecture

All routes require `protect` (authenticated only — no guest checkout,
unlike Cart):

```
POST   /checkout                        — create a Checkout session from the user's active cart
GET    /checkout/:id
POST   /checkout/:id/validate            — revalidate against live price/stock, returns { checkout, issues }
PATCH  /checkout/:id/shipping-address     — { addressId } or a full address body
PATCH  /checkout/:id/billing-address      — { sameAsShipping } or { addressId } or a full address body
GET    /checkout/:id/shipping-methods     — { methods } — server-computed list, no cost from the client
PATCH  /checkout/:id/shipping-method       — { shippingMethodId }
POST   /checkout/:id/coupon                — { code } — server resolves the discount, never accepts one
DELETE /checkout/:id/coupon
POST   /checkout/:id/place-order           — creates the Order, returns 201 (or 200 if an Idempotency-Key retry
                                              reused an existing order); response is { order, ... } (`reused: true`
                                              on the replay path)
```

`place-order` reads an `Idempotency-Key` header (or `idempotencyKey` in the
body as a fallback) and stores it on `Checkout.idempotencyKey` — a retried
request with the same key returns the already-created order instead of
attempting a second one. All `:id` lookups are scoped to `{_id, user:
req.user._id}` — a checkout id belonging to another user 404s the same as
a nonexistent one.

Response bodies are resource-keyed (`{ checkout }`, `{ methods }`), same
pattern as the rest of the API — `checkout.pricing.total` is always the
server-computed truth; the client never sends a total, subtotal, shipping
cost, or discount amount.

## Payment webhook (Phase 7, generalized in Phase 8)

`POST /payments/webhook/:provider` — no `protect` middleware; the payment
provider is the caller, not a logged-in customer. `:provider` was
`/payments/webhook/razorpay` through Phase 7; Phase 8 generalized the URL
to a `:provider` segment so a second provider wouldn't need a near-identical
second route — Razorpay is still the only one that actually works
(`stripeProvider.js` is a structural stub, see `docs/payments.md`). Verifies
`x-razorpay-signature`/`stripe-signature` as HMAC of the raw request body
against the provider's own webhook secret (fails closed with 503 if
unconfigured). Deduplicates via a unique `WebhookEvent` index so a retried
delivery of the same event is a no-op. `payment.captured` commits the
inventory reservation and marks the order `paid`; `payment.failed` releases
it and cancels the order. See `docs/checkout.md#payment-webhook` and
`docs/payments.md` for the full flow.

## Payments (Phase 8) — see `docs/payments.md` for the full architecture

```
POST /orders/:id/retry-payment      — authenticated, owner only
GET  /orders/:id/payment-status     — authenticated, owner only
POST /payments/:paymentId/refund    — admin only
```

`POST /orders/verify` — unchanged request shape (`{orderId,
razorpay_order_id, razorpay_payment_id, razorpay_signature}`), but the
response now also carries `paymentStatus`: `{ order, paymentStatus }`, read
from the `Payment` record `verifyClientPayment` just settled — lets the
frontend distinguish "order exists" from "payment actually succeeded"
without a second round trip.

`POST /orders/:id/retry-payment` — no body required (`Idempotency-Key`
header or `{idempotencyKey}` body optional, namespaced internally as
`` `${idempotencyKey}:${order._id}` ``, see `docs/payments.md#idempotency`).
Only allowed when the order isn't `shipped`/`delivered`/`cancelled` and the
payment isn't already `succeeded`/`refunded`/`partially_refunded`. Response:
`{ razorpayOrderId, amount, reused }` — a new `PaymentAttempt` row
(`attemptNumber` incremented), old attempts untouched.

`GET /orders/:id/payment-status` — response: `{ orderStatus,
paymentStatus }`. For a "processing your payment" screen to poll rather
than assuming success the instant the client-side provider callback fires.

`POST /payments/:paymentId/refund` (admin-only, `protect` + `adminOnly`) —
`{ amount?, reason }`, `Idempotency-Key` header (or `{idempotencyKey}` body)
optional but recommended — a duplicate refund request with the same key
returns the existing refund rather than issuing a second one. `amount` is
minor units (paise); omitted means a full refund of the remaining
refundable balance (`payment.amount - payment.refundedAmount`), capped at
that same remainder if provided. Response is 201 with the created/existing
`Refund`.

## Orders (Phase 9) — see `docs/orders.md` for the full architecture

```
POST /orders                    — { items, shippingAddress }, Idempotency-Key header supported
GET  /orders/my-orders           — ?page=&limit=&status=&search=
GET  /orders/:id
GET  /orders/:id/timeline
PUT  /orders/:id/cancel
GET  /orders                    — admin, ?page=&limit=&status=&search=
PUT  /orders/:id/status          — admin, { status }
```

`GET /orders/my-orders?page=&limit=&status=&search=` — response:
`{ orders, page, limit, total, totalPages }`. `orders` is
`toOrderSummaryDTO` (`utils/orderDTO.js`) — id, orderNumber, `status`,
`paymentStatus`, `fulfillmentStatus`, item count, first item name, total,
currency, createdAt — never the full item list or addresses. `search`
matches against `orderNumber` (case-insensitive). `limit` capped at 50.

`GET /orders/:id` — response `{ order }`, now `toOrderDetailDTO`, not a raw
Mongoose document — never includes `idempotencyKey`, `checkout` (internal
ref), or `razorpaySignature`. Ownership enforced by `order.user ===
req.user._id` (admin role escape hatch), same IDOR rule as every other
order endpoint.

`GET /orders/:id/timeline` — the append-only `OrderEvent` history for one
order. Response: `{ orderNumber, events }`, `events` mapped through
`toOrderTimelineEventDTO`. Same ownership rule as `GET /orders/:id`.

`PUT /orders/:id/cancel` — no body. Gated by
`utils/cancellationPolicy.js#assertCustomerCanCancel`: only allowed while
`Order.status` is `pending_payment`, `payment_processing`, `confirmed`, or
`processing` — once `packed` or later, cancellation is rejected regardless
of role (there is still no `DELETE /orders/:id`). Response: `{ order }`
(detail DTO).

`GET /orders` (admin) — same pagination/search shape as `my-orders`, but
unscoped by user and returns full item lists (populates `user` with
`firstName lastName email`).

`PUT /orders/:id/status` (admin) — `{ status }`. Validated against the
explicit transition graph in `utils/orderStateMachine.js`
(`assertValidTransition`) before being applied — an invalid transition
(e.g. `delivered → processing`, or skipping stages like `confirmed →
shipped`) is rejected with `409 { code: "INVALID_ORDER_TRANSITION" }`
rather than silently `$set`. A valid transition also updates
`fulfillmentStatus` via `ORDER_TO_FULFILLMENT_STATUS` when that status maps
to one. Response: `{ order }` (detail DTO).

`POST /orders` — now reads an `Idempotency-Key` header (or
`idempotencyKey` in the body) and stores it on `Order.idempotencyKey`
(unique, sparse) — a repeated request with the same key returns the
existing order instead of creating a duplicate. This is a second,
order-model-level idempotency layer independent of Checkout's own atomic
claim (Phase 7); it's what covers the legacy direct-create path, which has
no Checkout session to claim against.

## Shipping & Fulfillment (Phase 10) — see `docs/shipping.md` for the full architecture

Customer-facing, all authenticated (`protect`):

```
GET /orders/:orderId/shipments   — ownership-checked via the order; empty list, not 404, if nothing's shipped yet
GET /shipments/:id                — 403 if the shipment's order doesn't belong to req.user (admin bypasses)
GET /shipments/:id/tracking       — same ownership rule, adds full event history
```

All three return `utils/shipmentDTO.js` shapes (`toShipmentSummaryDTO` /
`toShipmentTrackingDTO`), never a raw Mongoose document — excludes
`carrierShipmentId` (internal carrier reference), `carrierShippingCost`
(rule #52 — never reveal what the carrier actually charges, only
`customerShippingCharge`), `idempotencyKey`, and raw webhook metadata.
`GET /shipments/:id/tracking` response: `{ ...summary, events: [{ status,
location, description, eventTime }] }`.

Admin, mounted at `/api/v1/admin/shipments` and `/api/v1/admin/fulfillments`
and `/api/v1/admin/warehouses` (all `protect` + `adminOnly` — no
SUPPORT/WAREHOUSE intermediate role exists in this project's RBAC, same
honest limitation noted since Phase 9):

```
GET  /admin/warehouses                        — list
POST /admin/warehouses                        — { name, code, address }

GET  /admin/fulfillments                      — ?status=&warehouseId=&page=&limit=
POST /admin/fulfillments                      — { orderId, warehouseId, items }
GET  /admin/fulfillments/:id                  — { fulfillment, ... } via fulfillmentService.getFulfillment
POST /admin/fulfillments/:id/allocate         — pending -> allocated
POST /admin/fulfillments/:id/pick             — allocated -> picking
POST /admin/fulfillments/:id/pack             — picking -> packing
POST /admin/fulfillments/:id/ready            — packing -> ready_to_ship

GET  /admin/shipments                         — ?status=&page=&limit=
POST /admin/shipments                         — { fulfillmentId, carrier, shippingMethod }, Idempotency-Key
                                                  header (or {idempotencyKey}) optional; response
                                                  { shipment, reused } — a repeated key returns the
                                                  existing shipment instead of opening a second carrier one
POST /admin/shipments/:id/label               — generates (or returns existing) labelUrl
POST /admin/shipments/:id/cancel
POST /admin/shipments/:id/poll                — calls the carrier adapter's trackShipment and applies
                                                  status the same way a webhook would
```

`Fulfillment`/`Shipment` state transitions are not validated against an
explicit "requested transition is one step" graph the way
`orderStateMachine.js` validates `PUT /orders/:id/status` — each
admin action above maps to exactly one fixed next state, so there's nothing
to select between.

`POST /shipping/webhooks/:carrier` — no `protect` middleware, the carrier is
the caller. Signature read from `x-mock-carrier-signature` or
`x-webhook-signature`, HMAC-verified over `req.rawBody` (same capture Phase
8's payment webhook uses), fails closed if no secret is configured for that
carrier. Deduplicated via the same `WebhookEvent` model Phase 8 introduced
(`provider` = carrier name) — a duplicate delivery returns `{ ok: true,
duplicate: true }` without reprocessing. `shipmentService.applyShipmentStatus`
only blocks backward/stale-timestamped events; any forward move — however
many intermediate statuses it skips — is applied (see `docs/shipping.md`
for the bug this fixed).

## Discounts & Promotions (Phase 11)

`POST /checkout/:id/coupon` and `DELETE /checkout/:id/coupon` (existing
Phase 7 routes) now run through the real promotion engine
(`docs/promotions.md`) instead of a flat percent/fixed calculation.
`POST` sits behind a dedicated rate limiter (30 requests / 15 min per IP,
same shape as `authLimiter`) — coupon codes are an enumeration target.
Structured error codes on failure: `COUPON_NOT_FOUND`, `COUPON_EXPIRED`,
`COUPON_NOT_ACTIVE`, `COUPON_USAGE_LIMIT_REACHED`,
`COUPON_CUSTOMER_LIMIT_REACHED`, `COUPON_MINIMUM_ORDER_NOT_MET`,
`COUPON_NOT_ELIGIBLE`, `COUPON_NOT_APPLICABLE`,
`COUPON_STACKING_NOT_ALLOWED`.

Every checkout response (`GET /checkout/:id` and every mutating checkout
endpoint) now also includes:

```
discountAmount     — total discount across all applied promotions
freeShipping       — true if any applied promotion grants free shipping
appliedPromotions  — [{ promotion, name, type, discountAmount, source }]
                      source: "automatic" | "coupon" — automatic (no-code)
                      promotions can appear here even with no coupon typed in
```

`checkout.pricing.shipping` already reflects `freeShipping` (0 when true) —
never recompute this client-side.

Admin, mounted at `/api/v1/admin/promotions` and `/api/v1/admin/coupons`
(`protect` + `adminOnly` — no MARKETING/SUPPORT role exists in this
project's RBAC, same honest limitation noted since Phase 9):

```
GET   /admin/promotions               — ?status=&type=&search=&page=&limit=
POST  /admin/promotions               — { name, description, type, status, priority,
                                          startAt, endAt, conditions, actions,
                                          requiresCoupon, usageLimit, perCustomerLimit,
                                          stackable, exclusive }
GET   /admin/promotions/:id
PATCH /admin/promotions/:id           — same field set, partial update
POST  /admin/promotions/:id/activate
POST  /admin/promotions/:id/pause
POST  /admin/promotions/:id/archive

GET   /admin/coupons                  — ?status=&search=&page=&limit=, populates promotion {name, type}
POST  /admin/coupons                  — { code, promotion, usageLimit?, perCustomerLimit?, startAt?, endAt? }
                                          (all override fields optional — fall back to the Promotion's own value)
POST  /admin/coupons/:id/activate
POST  /admin/coupons/:id/pause
```

No `DELETE` on either — promotions/coupons are archived/paused, never
physically removed, same "no delete endpoint" rule Phase 9 established for
Orders.

The order detail response (`GET /orders/:id`) gained a `promotions` field
— `[{ name, type, discountAmount, freeShipping }]`, the frozen snapshot
from `Order.promotionSnapshots` — and each entry in `items[]` gained
`discountAmount` (that line's allocated share of the total discount).

## Reviews & Ratings (Phase 12) — see `docs/reviews.md` for the full architecture

> **Breaking change — the old Review API is gone, not extended.** Phase 0's
> minimal review endpoints (`GET /reviews/product/:productId`, `POST
> /reviews`, `PUT /reviews/:id`, `PUT /reviews/:id/helpful`) no longer exist.
> They're replaced entirely by the routes below — new URL shapes, new
> request/response bodies, new verification/moderation/vote/report
> semantics. Any existing client integration against the old endpoints
> would 404.

Public, nested under products (`/products/:productId/reviews`):

```
GET  /                — ?sort=&rating=&verifiedOnly=&hasPhotos=&page=&limit=, always paginated
GET  /summary          — { average, count, distribution: {1..5: count}, verifiedCount, photoCount }-shaped aggregate
POST /                 — authenticated, rate-limited (20/15min per IP): { rating, title, body, variantId?, media? }
```

`POST /products/:productId/reviews` — `rating` (1-5 integer, required),
`title`/`body` (sanitized via `utils/sanitizeText.js#sanitizePlainText` —
all HTML tags and `javascript:` URIs stripped, never rendered as markup),
`variantId` (optional), `media` (optional, validated by
`validateMediaBatch` — 5 images / 1 video cap, MIME allow-list, size caps).
The client cannot send `isVerifiedPurchase`, `order`, or `status` — those
are set server-side by `reviewEligibilityService`/`reviewModerationService`.
Rejected with `REVIEW_NOT_ELIGIBLE` if `REVIEW_REQUIRE_PURCHASE` (env,
default `"true"`) is set and the customer has no `paymentStatus:
"succeeded"` order containing the product. A second review for the same
product by the same customer 409s — `unique {product, user}` DB index, see
`docs/database.md`.

Authenticated, mounted at `/reviews` (id-based operations):

```
GET    /my              — the customer's own reviews, including non-published ones
GET    /:id              — optionalAuth: public if published; owner/admin can see their own pending/rejected/hidden one
PATCH  /:id              — rate-limited (60/15min per IP): { rating?, title?, body? }, owner only
DELETE /:id              — soft-delete (status: "deleted"), owner only — the document is kept, not removed
POST   /:id/vote         — rate-limited: { vote: "helpful" | "not_helpful" } — upserts, switching votes updates the same row
DELETE /:id/vote         — removes the customer's own vote
POST   /:id/report       — rate-limited: { reason, description? } — reason one of spam/offensive/fake_review/irrelevant/abusive/other
```

`POST /:id/vote` rejects self-voting on your own review (`REVIEW_NOT_OWNER`).
`POST /:id/report` 409s on a second active report by the same customer for
the same review — `unique {review, user}` index, same pattern as the review
uniqueness constraint above.

Admin, mounted at `/admin/reviews` and `/admin/review-reports` (both
`protect` + `adminOnly`):

```
GET   /admin/reviews                — ?status=&product=&rating=&page=&limit= — the moderation queue
GET   /admin/reviews/:id            — { review, media, reports }
PATCH /admin/reviews/:id/status     — { action: "approve"|"reject"|"hide"|"restore", reason? } — validated against
                                       reviewModerationService's transition graph, 409s on an invalid one
PATCH /admin/reviews/:id/featured   — { featured: boolean }

GET   /admin/review-reports         — ?status=&page=&limit=
PATCH /admin/review-reports/:id     — { status: "under_review"|"resolved"|"dismissed" }
```

Every status transition through `PATCH /admin/reviews/:id/status` runs
through `reviewModerationService.js#moderate` — the only path that also
updates `Product.rating`/`reviewsCount`/`ratingDistribution` via the atomic
`ratingAggregationService` deltas, so a controller can never flip `status`
and forget the aggregate side effect.

`Product`'s existing `rating`/`reviewsCount` fields are now populated by
this phase (previously always `0`/no reviews existed to populate them) —
see `docs/database.md` for the new `ratingSum`/`ratingDistribution`/
`verifiedReviewCount`/`photoReviewCount` fields backing them.

## Search & Product Discovery (Phase 13) — see `docs/search.md` for the full architecture

> **Additive, not a replacement.** `GET /products?search=` (Phase 3's plain
> `$text` search against `Product` directly, see Catalog above) still exists
> unchanged for basic catalog browsing. `GET /search` is new and separate —
> it queries the denormalized `ProductSearchIndex` projection instead, and
> is where facets, ranking, synonyms, merchandising, zero-result handling,
> and analytics tracking all live.

Public, mounted at `/search`, all `optionalAuth` and rate-limited:

```
GET  /search                — main search: ?q=&categoryId=&minPrice=&maxPrice=&rating=&availability=&sort=&page=&limit=
GET  /search/autocomplete   — ?q= (min 2 chars), ?limit=
GET  /search/suggestions    — ?q= (min 2 chars), ?limit=
POST /search/events/click   — { query, productId, position }
```

`GET /search` response: `{ query, products, total, page, pageSize,
totalPages, facets, sort, appliedFilters }` — `products` is a compact DTO
(`productId, name, slug, category, price, minPrice, maxPrice, rating,
reviewCount, inventoryStatus, featured`), never a full product fetch per
hit. If a `SearchRule` with `action: "redirect"` matches the query, the
response short-circuits to `{ redirect: "<url>" }` before any query
execution. On zero results (and a non-empty `q`), the response additionally
carries `didYouMean` (Levenshtein-based spelling suggestion), `popularProducts`
(fallback list), and `suggestedSearches` (recent top queries) — never a bare
empty list. `page` capped beyond 500 (`DEEP_PAGINATION_LIMIT`, 400); `limit`
capped at 50 regardless of what's requested.

`GET /search/autocomplete` response: `{ products, categories, searches }` —
`products` is an even more compact shape (`productId, name, slug, price,
category, rating`). Returns all-empty arrays for a query under 2 characters
rather than erroring.

`GET /search/suggestions` response: `{ suggestions }` — a flattened
merge of autocomplete's `searches` + `categories`.

`POST /search/events/click` — records a `clicked`/`add_to_cart`-style
`SearchEvent` for CTR analytics; `sessionId`/`customerId` are derived
server-side from the guest-cart cookie / `req.user`, never accepted from the
client. Responds `201 { ok: true }`.

Rate limiters: `GET /search` — 60/min per IP; `GET /search/autocomplete` and
`GET /search/suggestions` — 120/min per IP (looser than the coupon/review
limiters — normal shopping behavior legitimately fires many autocomplete
requests per session — but still bounded against scraping).

Admin, mounted at `/admin/search` (`protect` + `adminOnly`):

```
GET    /admin/search/synonyms        — list all
POST   /admin/search/synonyms        — { term, synonyms[], status? }
PATCH  /admin/search/synonyms/:id
DELETE /admin/search/synonyms/:id

GET    /admin/search/rules           — ?query=&status=&... (passed through to searchRuleService)
POST   /admin/search/rules           — { query, action: "pin"|"boost"|"bury"|"redirect", product?, redirectUrl?, priority?, status?, startAt?, endAt? }
PATCH  /admin/search/rules/:id
DELETE /admin/search/rules/:id

POST   /admin/search/reindex         — full reindexAll() from Product/ProductVariant, response is indexingService's own summary
POST   /admin/search/reconcile       — diffs Product ids against ProductSearchIndex ids, re-indexes missing, removes orphaned
GET    /admin/search/health          — { ...provider.healthCheck() } — reports which SEARCH_PROVIDER is active
GET    /admin/search/analytics       — ?days= (default 30): { topQueries, zeroResultQueries, ctr, zeroResultRate }
```

No `DELETE` on rules/synonyms is soft — these two do hard-delete, unlike
Order/Promotion/Coupon's archive-only pattern, since a synonym or
merchandising rule carries no downstream financial record that needs to
survive removal.

## Admin Dashboard & RBAC (Phase 14) — see `docs/admin.md` for the full architecture

Every route below (except accept-invite) sits behind two layered gates:
`protect` + `adminOnly` (the existing coarse "is this person staff at all"
check, unchanged since Phase 1) **and** `requirePermission("module.action")`
(new — `utils/rbac.js`, resolved from the authenticated user's
server-side `User.adminRole`, never from a client-supplied claim). The
coarse gate is never removed or bypassed; the permission check is layered
on top, so a narrower role (e.g. `CATALOG_MANAGER`) can pass `adminOnly`
and still 403 on an endpoint it lacks the specific permission for.

```
GET  /admin/dashboard?range=today|yesterday|7d|30d|90d   — requirePermission("analytics.read")
```
Response: `{ range, kpis: { revenue, orders, newCustomers, averageOrderValue }
(each { value, growth }), revenueBreakdown, products: { byStatus },
lowStock, topProducts, recentOrders, recentActivity, pendingReviewCount,
search: { zeroResultRate, topQueries } }`. `dashboardService.js` runs every
section as an independent concurrent `Promise.all` query — a slow section
never blocks the others. `kpis.*.growth` is computed from the identical
aggregation run against the prior period of equal length, never fabricated.

```
GET    /admin/roles         — requirePermission("administration.manage_roles")
POST   /admin/roles         — { name, description, permissions[] }
PATCH  /admin/roles/:id     — { description?, permissions? }
DELETE /admin/roles/:id
```
`GET /admin/roles` response: `{ roles, permissionGroups, allPermissions }` —
`permissionGroups` is `utils/rbac.js#PERMISSIONS` (grouped by module, for
rendering a permission-picker UI), `allPermissions` the flattened list.
`PATCH`/`DELETE` 403 with `SYSTEM_ROLE_PROTECTED` against any of the nine
seeded roles (`Role.isSystem`) — renaming or deleting one of those would
break every permission check that assumes it exists.

```
POST /admin/admin-users/accept-invite   — { token, firstName, lastName, password } — NO auth, rate-limited
                                            (10/15min per IP) — the invite token IS the credential
GET  /admin/admin-users                 — requirePermission("administration.manage_admins")
POST /admin/admin-users/invite          — { email, roleId }
PATCH /admin/admin-users/:id/role       — { roleId }
POST /admin/admin-users/:id/deactivate
```
`GET /admin/admin-users?page=&limit=` — response: `{ users, page, limit,
total, totalPages }`, `role: "admin"` only, `adminRole` populated with just
`name`. `POST /invite` — only a `SUPER_ADMIN` may invite another
`SUPER_ADMIN` (`PRIVILEGE_ESCALATION_BLOCKED`, 403); logs the accept link to
console (no real email delivery integrated, same honest gap as
`utils/otp.js`), response `{ invite: { id, email, expiresAt } }`. `PATCH
/:id/role` rejects changing your own role (`SELF_ROLE_CHANGE_BLOCKED`, 403)
and granting `SUPER_ADMIN` unless the actor already is one
(`PRIVILEGE_ESCALATION_BLOCKED`). `POST /:id/deactivate` rejects
deactivating yourself (`SELF_DEACTIVATION_BLOCKED`, 403) — a locked-out
admin can never be the one who locked themselves out.

```
GET  /admin/customers                — requirePermission("customers.read")
POST /admin/customers/:id/block      — requirePermission("customers.block") — { reason }
POST /admin/customers/:id/unblock    — requirePermission("customers.block")
```
`GET /admin/customers?search=&status=&page=&limit=` — response: `{
customers, page, limit, total, totalPages }`, `role: "customer"` only,
`search` matches email/firstName/lastName (case-insensitive). `POST
/:id/block` sets `User.status: "blocked"` + `blockedAt`/`blockedBy`/
`blockReason` — immediately prevents login (`middleware/auth.js` rejects
`status: "blocked"` at `protect` and at login) without deleting the account
or its order history. Distinct from the customer's own self-service
`"deactivated"` status (Phase 2) — an admin action and a customer's own
action are never ambiguous in the audit trail. `POST /:id/unblock` restores
`status: "active"` and clears the block fields.

```
GET /admin/audit-logs   — requirePermission("administration.view_audit_logs")
                           — ?actor=&action=&entityType=&entityId=&page=&limit=
```
Response: `{ logs, page, limit, total, totalPages }`, `actor` populated with
`firstName lastName email`. No `PATCH`/`DELETE` route exists for this
resource at all (not merely permission-gated) — `AdminAuditLog` is
append-only by convention, the same rule Phase 9 established for `OrderEvent`.
Deliberately separate from `OrderEvent` (Phase 9) and `ShipmentEvent` (Phase
10) — those answer "what happened to this order/shipment"; this answers
"what did this admin do," searchable across every module in one place.
Written via `services/admin/adminAuditService.js#recordAdminAction`, wired
into a representative sample of sensitive mutations (product update,
inventory adjustment, payment refund, role change, admin invite/accept,
customer block/unblock) — always wrapped `.catch(() => {})` so an
audit-logging failure never fails the underlying action.

## Headless CMS (Phase 15) — see `docs/cms.md` for the full architecture

### Public content API — `/content` (fully public, no auth, published-only)

```
GET /content/homepage
GET /content/pages/:slug
GET /content/blog                — ?category=&tag=&page=&limit=
GET /content/blog/:slug
GET /content/faqs                — ?category=
GET /content/navigation/:name    — "header" | "footer" | ...
GET /content/footer
GET /content/banners             — ?target=homepage|category|collection&targetId=

POST /content/banners/:id/impression
POST /content/banners/:id/click
```

Every function is served by `services/cms/contentApiService.js` and
enforces `status: "published"` unconditionally — fetching a draft/
in-review/scheduled/archived page or post by slug 404s
(`PAGE_NOT_FOUND`/`BLOG_NOT_FOUND`), never leaking unpublished content
through the public API (rule #82). `GET /content/pages/:slug` and
`GET /content/homepage` return a page whose `blocks[]` have their
commerce references (`productIds`, `categoryId`, `collectionId`,
`bannerId`, `faqIds`) already resolved to live `Product`/`Category`/
`Collection`/`Banner`/`FAQ` data via batched `$in` queries — one query per
entity type across the whole page, never one query per block (rule #151).
`POST /banners/:id/impression` / `/click` bump `Banner.impressions`/
`clicks` server-side (`$inc`) — never trusted from client-supplied counts.

### Admin page & blog lifecycle — `/admin/cms/pages`, `/admin/cms/blog`

`protect` + `adminOnly` (unchanged since Phase 1) plus
`requirePermission("cms.pages.*")` / `requirePermission("cms.blog.*")`
per route. **`publish` is gated by a separate permission from `update`**
(rule #71) — `cms.pages.publish`/`cms.blog.publish` vs.
`cms.pages.update`/`cms.blog.update` — so a `CONTENT_WRITER` role can
create/edit/submit-for-review and still 403 on `/:id/publish`,
`/:id/approve`, and `/:id/schedule` specifically.

```
GET    /admin/cms/pages                       — requirePermission("cms.pages.read") — ?status=&pageType=&page=&limit=
GET    /admin/cms/pages/homepage              — requirePermission("cms.pages.read") — getOrCreateHomepage (lazy singleton)
POST   /admin/cms/pages                       — requirePermission("cms.pages.create") — { pageType, title, slug, blocks[], seo? }
GET    /admin/cms/pages/:id                   — requirePermission("cms.pages.read")
PATCH  /admin/cms/pages/:id                   — requirePermission("cms.pages.update")
POST   /admin/cms/pages/:id/duplicate         — requirePermission("cms.pages.create")
POST   /admin/cms/pages/:id/submit-review     — requirePermission("cms.pages.update")
POST   /admin/cms/pages/:id/approve           — requirePermission("cms.pages.publish")
POST   /admin/cms/pages/:id/publish           — requirePermission("cms.pages.publish")
POST   /admin/cms/pages/:id/schedule          — requirePermission("cms.pages.publish") — { scheduledAt }
POST   /admin/cms/pages/:id/archive           — requirePermission("cms.pages.delete")
POST   /admin/cms/pages/:id/restore           — requirePermission("cms.pages.update")
POST   /admin/cms/pages/:id/send-back         — requirePermission("cms.pages.update")
GET    /admin/cms/pages/:id/revisions         — requirePermission("cms.pages.read")
POST   /admin/cms/pages/:id/revisions/:version/restore — requirePermission("cms.pages.update")
POST   /admin/cms/pages/run-scheduler         — requirePermission("cms.pages.publish") — processScheduledPages()
```

`/admin/cms/blog` mirrors the exact same shape (`GET /`, `POST /`,
`GET /:id`, `PATCH /:id`, `submit-review`/`approve`/`publish`/`schedule`/
`archive`/`restore`/`revisions`/`revisions/:version/restore`/
`run-scheduler`) against `cms.blog.*` permissions — the one difference is
no `duplicate` or `send-back` route exists for blog posts. Every response
wraps the entity as `{ page: {...} }` / `{ blog: {...} }` (or `{ pages: [...] }`,
`{ revisions: [...] }` for lists) via `pageAdminController.js`/
`blogAdminController.js`.

Lifecycle (`utils/contentStateMachine.js`): `draft → in_review → approved
→ scheduled → published → archived`, with `archived → draft` for restore.
`send-back` returns `in_review`/`approved`/`scheduled` to `draft`
explicitly and is the **only** way to edit a page/post that's already
`published`/`archived` — `PATCH` on a published/archived entity 400s
(`PAGE_NOT_EDITABLE`/`BLOG_NOT_EDITABLE`) rather than allowing an in-place
edit of live content. `publish`/`schedule`/`approve` run
`services/cms/publishValidationService.js` first — a broken commerce
reference (archived product, missing banner/FAQ, non-`ready` media)
blocks the transition with `PUBLISH_VALIDATION_FAILED` and returns every
issue found, not just the first. `POST /:id/revisions/:version/restore`
creates a **new** revision and returns the entity to `draft` — it never
republishes directly and never deletes intervening revisions.
`POST .../run-scheduler` is the admin-triggered stand-in for a real cron
job (no job scheduler exists in this project) — it flips any
`scheduled` entity whose `scheduledAt` has passed to `published`.

### Admin CMS misc — `/admin/cms` (media, navigation, footer, FAQs, banners, redirects, SEO)

```
GET    /admin/cms/media                     — requirePermission("cms.pages.read")
GET    /admin/cms/media/orphaned            — requirePermission("cms.pages.read")
POST   /admin/cms/media                     — requirePermission("cms.media.upload") — rate-limited 100/15min per IP
DELETE /admin/cms/media/:id                 — requirePermission("cms.media.delete")

GET    /admin/cms/navigation                — requirePermission("cms.pages.read")
GET    /admin/cms/navigation/:name          — requirePermission("cms.pages.read")
PUT    /admin/cms/navigation/:name          — requirePermission("cms.navigation.update") — { items[] }

GET    /admin/cms/footer                    — requirePermission("cms.pages.read")
PUT    /admin/cms/footer                    — requirePermission("cms.navigation.update")

GET    /admin/cms/faqs                      — requirePermission("cms.pages.read") — ?category=&status=
POST   /admin/cms/faqs                      — requirePermission("cms.pages.create")
PATCH  /admin/cms/faqs/:id                  — requirePermission("cms.pages.update")
DELETE /admin/cms/faqs/:id                  — requirePermission("cms.pages.delete")

GET    /admin/cms/banners                   — requirePermission("cms.pages.read")
POST   /admin/cms/banners                   — requirePermission("cms.pages.create")
PATCH  /admin/cms/banners/:id               — requirePermission("cms.pages.update")
DELETE /admin/cms/banners/:id               — requirePermission("cms.pages.delete")

GET    /admin/cms/redirects                 — requirePermission("cms.redirects.manage")
GET    /admin/cms/redirects/resolve         — requirePermission("cms.redirects.manage") — ?path=
POST   /admin/cms/redirects                 — requirePermission("cms.redirects.manage")
PATCH  /admin/cms/redirects/:id             — requirePermission("cms.redirects.manage")
DELETE /admin/cms/redirects/:id             — requirePermission("cms.redirects.manage")

GET    /admin/cms/seo                       — requirePermission("cms.pages.read")
PUT    /admin/cms/seo                       — requirePermission("cms.seo.update")
```

`POST /media` — `mediaService.uploadMedia` enforces a MIME allow-list and
size limit (SVG deliberately excluded — XSS risk, no sanitizer exists for
it); `url`/`storageKey` are supplied by the caller since no real object
storage/CDN is integrated (same honest-stub pattern as Phase 12's
`ReviewMedia`). `DELETE /media/:id` 400s (`MEDIA_IN_USE`) if the asset is
still referenced by any page/blog/banner block. `PUT /navigation/:name`
and `PUT /footer` fully replace the single named document (upsert) — both
`NavigationMenu` and `FooterConfig` are singletons, not a growing
collection. `POST /redirects` walks the existing redirect chain (up to 20
hops) and rejects a self-redirect, a direct A↔B loop
(`REDIRECT_LOOP`), or a duplicate `source` (`REDIRECT_SOURCE_TAKEN`).
`PUT /seo` is gated by `cms.seo.update` specifically, separate from
`cms.pages.update`, so an ordinary content editor can't set the whole
site to `noindex` while editing one page (rule #58/#126).

Three new default roles ship with this phase: `CONTENT_WRITER`
(create/edit, no publish), `CONTENT_EDITOR` (full CMS access including
publish), `SEO_MANAGER` (scoped to `cms.seo.update`/
`cms.redirects.manage` only — can't touch page/blog content at all).

## Notifications (Phase 16) — see `docs/notifications.md` for the full architecture

Business modules never call an email/SMS/push provider directly — they
publish a domain event (`ORDER_CREATED`, `PAYMENT_SUCCESSFUL`,
`ORDER_SHIPPED`, `LOW_STOCK`, `REVIEW_APPROVED`, `CONTENT_PUBLISHED`,
`PASSWORD_CHANGED`, etc.) through an in-process event bus backed by an
outbox table (`NotificationEvent`) for durability — no real message broker
exists in this project, matching every other "scheduled"/"queued"
mechanism here (lazy-checked or admin-triggered, never a real worker).

Customer:
```
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
PATCH  /api/v1/notifications/:id/archive
GET/PATCH /api/v1/notifications/preferences
POST   /api/v1/notifications/unsubscribe
POST/GET/DELETE /api/v1/notifications/devices[/:deviceId]
```

Admin:
```
GET  /api/v1/admin/notifications
GET  /api/v1/admin/notifications/deliveries[/:id]
GET  /api/v1/admin/notifications/dead-letter
POST /api/v1/admin/notifications/dead-letter/:id/retry|cancel
POST /api/v1/admin/notifications/process-retries
POST /api/v1/admin/notifications/reprocess-events
GET/POST/PATCH /api/v1/admin/notifications/templates[/:id]
POST /api/v1/admin/notifications/templates/:id/publish
GET/POST /api/v1/admin/notifications/templates/:id/revisions[/:revisionId/restore]
POST /api/v1/admin/notifications/templates/:id/preview
POST /api/v1/admin/notifications/test
GET/DELETE /api/v1/admin/notifications/suppressions[/:channel/:value]
GET  /api/v1/admin/notifications/providers        (masked credentials only)
GET  /api/v1/admin/notifications/analytics/deliveries|queue-health

GET/POST/PATCH /api/v1/admin/campaigns[/:id]
POST /api/v1/admin/campaigns/:id/schedule|pause|send
GET  /api/v1/admin/campaigns/:id/analytics
```

Channels (`email`/`sms`/`push`/`web_push`/`whatsapp`/`in_app`) use a
console-log provider as the real, working default — same "honest stub"
pattern as `utils/otp.js` — with real SMTP/Twilio/FCM/WhatsApp providers
left as structural stubs pending an SDK and credentials
(`PROVIDER_NOT_CONFIGURED`, never a faked success). `notifications.campaigns.create`
is a separate permission from `notifications.campaigns.send`, mirroring
the CMS phase's edit-vs-publish separation.

## Analytics (Phase 17) — see `docs/analytics.md` for the full architecture

Business events (already published to Phase 16's event bus) are consumed
a second time by an analytics worker that updates day-grain aggregate
tables incrementally — no query scans transactional Order/Payment tables
directly except a few documented, already-indexed exceptions (order status
distribution, inventory, reviews). Client-instrumented behavioral events
(`PAGE_VIEW`, `PRODUCT_VIEW`, `ADD_TO_CART`, `CHECKOUT_STARTED`, etc.) are
ingested publicly:

```
POST /api/v1/analytics/events[/batch]
```

Admin dashboards:
```
GET /api/v1/admin/analytics/overview|sales|revenue|orders|customers|products
GET /api/v1/admin/analytics/categories|inventory|payments|shipping|discounts
GET /api/v1/admin/analytics/reviews|search|notifications|funnel|cohorts
POST/GET /api/v1/admin/analytics/exports[/:id][/download]
GET/POST /api/v1/admin/analytics/reports[/:id/run]
GET  /api/v1/admin/analytics/reconcile
POST /api/v1/admin/analytics/rebuild
```

Every category has its own RBAC permission (`analytics.sales.read`,
`analytics.customers.read`, etc.) in addition to the general
`analytics.read` Phase 14 already established. `analytics.rebuild` is
deliberately separate and high-level — rebuilding aggregates from source
data is correctness-critical. Metric formulas (gross/net sales, AOV,
conversion, historical CLV) are centralized in one `metricService.js`,
never reinvented per endpoint.

## Rate limits

- `/api/v1/auth/*`: 20 requests / 15 min per IP.
- `/api/v1/checkout/:id/coupon` (POST): 30 requests / 15 min per IP.
- `/api/v1/products/:productId/reviews` (POST): 20 requests / 15 min per IP.
- `/api/v1/reviews/:id` (PATCH), `/api/v1/reviews/:id/vote` (POST),
  `/api/v1/reviews/:id/report` (POST): 60 requests / 15 min per IP.
- `/api/v1/search` (GET): 60 requests / min per IP.
- `/api/v1/search/autocomplete`, `/api/v1/search/suggestions` (GET):
  120 requests / min per IP.
- `/api/v1/admin/admin-users/accept-invite` (POST): 10 requests / 15 min
  per IP — no session exists yet at this point, so the invite token itself
  is the only thing standing between this route and token-guessing.
- `/api/v1/*` (everything else): 300 requests / 15 min per IP.
