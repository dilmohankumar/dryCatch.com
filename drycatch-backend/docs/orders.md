# Orders (Phase 9)

## The core rule

An order is a permanent business record, not a live view of the cart. Once
created, nothing about it should ever be recalculated from current catalog,
coupon, or tax data — everything it needs to display correctly is
snapshotted at creation time (product name/price/SKU/variant label,
addresses, coupon code + discount amount, shipping method + cost, tax
amount). A later price change, product rename, or coupon expiry must never
alter what an existing order shows. This was already substantially true
after Phase 7 (order items already snapshot name/sku/price/variantLabel);
this phase makes the coupon snapshot explicit (`couponSnapshot`) and adds
the state-machine/eventing/DTO layer around it.

## Before this phase

`Order.status` was a single seven-value enum (`pending, paid, processing,
shipped, delivered, cancelled`) doing three jobs at once: business
lifecycle, payment confirmation, and fulfillment stage. `"paid"` was really
a payment fact wearing an order-status hat. No order number beyond the raw
Mongo `_id`. No transition validation — `updateOrderStatus` (admin) did a
blind `$set`, so nothing stopped `delivered → processing`. No event/audit
history — support could see the *current* status but not how it got there.
No pagination on `getMyOrders`/`getAllOrders`. No customer-facing DTO — raw
Mongoose documents (including `razorpaySignature`, `idempotencyKey`,
`checkout` ref) went straight to the client.

## Three separate state dimensions

Per the spec's core rule (never one field doing three jobs):

- **`Order.status`** — the business/commercial lifecycle: `pending_payment
  → payment_processing → confirmed → processing → packed → shipped →
  out_for_delivery → delivered`, with `cancelled` reachable from the early
  states and `return_requested → returned → refunded` reserved for a future
  Returns phase (the enum values exist now so the schema doesn't need a
  migration later; no code transitions into them yet).
- **`Order.paymentStatus`** — mirrors `Payment.status` (Phase 8) directly on
  the order for cheap reads without a join: `pending, processing,
  succeeded, failed, refunded, partially_refunded`.
- **`Order.fulfillmentStatus`** — the shipping-relevant subset:
  `not_started, processing, packed, shipped, out_for_delivery, delivered`.
  Kept on `Order` directly rather than a separate Fulfillment/Shipment
  collection since that domain doesn't exist yet (rule #91) — moving it
  there later doesn't require this field to change shape, only its
  location.

## Order state machine

`utils/orderStateMachine.js` is the single source of truth for which
`Order.status` transitions are legal — an explicit adjacency list, not a
free-text field. `assertValidTransition(from, to)` throws
`INVALID_ORDER_TRANSITION` (409) for anything not in the graph. Verified:
`confirmed → processing` succeeds, `confirmed → shipped` (skipping stages)
and `delivered → processing` (moving backward) are both rejected. The admin
`PUT /orders/:id/status` endpoint is the only place `Order.status` is ever
admin-settable, and it always goes through this gate — no more blind
`$set`.

## Order number

`utils/orderNumber.js#generateOrderNumber()` — `DC-<year>-<6-digit
sequence>` (e.g. `DC-2026-000123`), backed by `OrderCounter`, a one-
document-per-year atomic counter (`findOneAndUpdate` with `$inc`, not
"read the max and add one" — that would race under concurrent order
creation). Verified: two calls in immediate succession produced distinct,
sequential numbers. The Mongo `_id` remains the internal reference
everywhere in code; `orderNumber` is the only identifier a customer or
support agent ever sees or searches by.

## Order events (the timeline)

`OrderEvent` — append-only, one row per meaningful transition (`type`,
`fromStatus`, `toStatus`, `message`, `actorType` — `CUSTOMER | ADMIN |
STAFF | SYSTEM | PAYMENT_PROVIDER | WAREHOUSE | DELIVERY_SYSTEM`,
`actorId`, `metadata`). `services/orderEventService.js#recordOrderEvent`
is the only way one gets written; nothing updates or deletes an
`OrderEvent` once created. Every transition in this phase logs one:
`ORDER_CREATED` (orderService), `PAYMENT_CONFIRMED`/`PAYMENT_FAILED`
(paymentService), `REFUND_COMPLETED`/`REFUND_PARTIAL` (paymentService),
`ORDER_CANCELLED`/`ORDER_STATUS_CHANGED` (orderController). `GET
/orders/:id/timeline` exposes this to the order detail page's timeline UI —
the frontend never hard-codes what stages exist; it renders whatever
events actually happened.

## Order creation idempotency

Two independent layers, protecting different paths:

- **Checkout's atomic claim** (Phase 7) — protects the Checkout-driven
  place-order flow.
- **`Order.idempotencyKey`** (this phase, unique sparse) — a second,
  order-model-level guard that also covers the legacy direct `POST /orders`
  path, which has no Checkout session to claim against. A repeated request
  with the same key returns the existing order (`reused: true`) instead of
  creating a duplicate. Verified: two `createOrderFromItems` calls with the
  same key returned the same order id.

## Cancellation policy

`utils/cancellationPolicy.js#canCustomerCancel` — a customer may cancel
while `pending_payment`, `payment_processing`, `confirmed`, or
`processing`; not once `packed` (picking/packing labor already spent) or
later (a Returns conversation, not a cancellation — future phase).
Verified: `canCustomerCancel` returned `true` at `processing` and `false`
at `packed`. There is still no `DELETE /orders/:id` anywhere in this
codebase — cancellation is always a status transition
(`PUT /orders/:id/cancel`), never a deletion; orders are historical
financial records.

## Ownership (IDOR)

Every customer-facing order query is scoped by `{_id, user: userId}` (or,
for `getOrderById`/`getOrderTimeline`, an explicit `order.user === req.user`
check with an admin-role escape hatch) — never by order id alone. Verified:
an ownership-scoped query for another user's order id returns `null`.

## DTOs

`utils/orderDTO.js` — `toOrderSummaryDTO` (list view: id, orderNumber,
three statuses, item count, first item name, total, currency, createdAt —
no full item list or addresses) and `toOrderDetailDTO` (full breakdown).
Neither ever includes `idempotencyKey`, `checkout` (internal ref), or the
legacy `razorpaySignature` — a raw Mongoose document is never returned
directly to a customer-facing endpoint.

## Pagination

`GET /orders/my-orders?page=&limit=&status=&search=` and the admin `GET
/orders` — both return `{orders, page, limit, total, totalPages}` instead
of every order in one response. `search` matches against `orderNumber`
(case-insensitive). `limit` is capped (50 for customers, 100 for admin) so
a client can't request an unbounded page size.

## What's explicitly NOT here yet (by design, not oversight)

- **Returns/refund-request workflow** — `return_requested`/`returned` exist
  in the status enum for forward compatibility; no endpoint transitions
  into them yet. Refunds themselves are already fully functional (Phase 8);
  what's missing is the customer-initiated *return request* flow that would
  precede an admin-approved refund.
- **Multiple shipments / partial fulfillment** — `fulfillmentStatus` lives
  directly on `Order` for now; the spec's future
  `Order → Fulfillment → Shipment` structure isn't built, since a single
  order can currently only have one fulfillment path. Nothing here prevents
  adding that structure later — `fulfillmentStatus` staying a simple field
  today doesn't lock in a one-shipment-per-order assumption at the data
  level in a way that would require a breaking migration.
- **Order notifications** (email/SMS on status change) — every transition
  is logged as an `OrderEvent`, which is exactly what a future
  `NotificationService` would subscribe to; no notification is actually
  sent yet.
- **Admin order dashboard UI** — the admin API (`GET /orders`,
  `PUT /orders/:id/status`) exists and is paginated/searchable; no admin
  frontend was built this phase (matches the spec's explicit "prepare, but
  don't build the full Admin module yet").
- **Invoice generation** — the order detail DTO carries every field a
  future `InvoiceService` would need (items, tax, discount, shipping,
  totals, addresses), but no PDF/invoice-number generation exists.
