# Checkout (Phase 7)

## The core rule

Checkout is a **controlled transaction**, not a form submission. Nothing the
client sends is trusted as fact — not the total, not the price, not the
shipping cost, not the discount. A `Checkout` session is created server-side
from the cart, and every subsequent step (address, shipping method, coupon,
place-order) mutates that server-owned document. The client only ever sends
identifiers (`addressId`, `shippingMethodId`, `code`) and reads back
server-computed numbers.

## Checkout vs Cart vs Order

Three distinct documents, three distinct lifetimes:

- **Cart** — long-lived, mutable, "what the customer is thinking about."
- **Checkout** — short-lived (`expiresAt`, 20 minutes), a snapshot of cart
  items plus in-progress address/shipping/coupon selections, walking through
  a state machine until it produces an Order or dies.
- **Order** — permanent, immutable once created, the record of what was
  actually purchased.

A `Checkout` never turns into an `Order` by mutation — `placeOrder` creates
a brand-new `Order` document and links `checkout.order = order._id`.

## State machine

```
active → validated → inventory_reserved → payment_pending → completed
  ↓           ↓              ↓                   ↓
expired    expired      (revert to active     failed
                          on order/reservation
                          failure)
```

- `active` — created, or sent back here after a revalidation finds issues
  (price changed, stock changed, item no longer available).
- `validated` — `POST /checkout/:id/validate` found no issues. This is
  advisory for the UI ("you're clear to proceed"); `placeOrder` always
  revalidates again itself rather than trusting this flag, since time can
  pass between validate and place-order.
- `inventory_reserved` — the atomic claim inside `placeOrder` has fired;
  this checkout is now exclusively owned by one in-flight request.
- `payment_pending` — an `Order` exists, inventory is reserved on it, a
  Razorpay order was created; waiting for the payment webhook.
- `completed` — webhook confirmed `payment.captured`.
- `expired` — `expiresAt` passed, or the customer took too long.
- `cancelled` / `failed` — explicit cancellation, or a payment failure.

## Revalidation, always against live data

`computeIssues(checkout)` (in `services/checkoutService.js`) is the single
source of truth for "is this checkout still purchasable." It checks, per
line: product/variant still active + public, current stock vs requested
quantity, and current price vs the snapshotted `unitPrice` (refreshing the
snapshot and flagging `PRICE_CHANGED` if they differ). It is a pure
function — it mutates the in-memory document but never saves and never
touches `status`. Two callers share it:

- `validateCheckout` (the public `POST /checkout/:id/validate` endpoint) —
  runs it, then owns the save and the `active`/`validated` status write.
- `placeOrder` — runs it against the document it has *already claimed*
  atomically (see next section), then owns that document's save.

Splitting it this way was a deliberate fix for a concurrency bug (see
below) — the two callers must never both be doing an independent
load-mutate-save cycle against the same document at the same time.

## Concurrency: same checkout submitted twice

The double-click / duplicate-request case (one customer, one checkout,
racing requests) is protected by claiming the checkout **before** any
validation runs:

```js
const claimed = await Checkout.findOneAndUpdate(
  { _id: checkoutId, user: userId, status: { $in: ["active", "validated"] } },
  { $set: { status: "inventory_reserved", ...(idempotencyKey ? { idempotencyKey } : {}) } },
  { new: true }
);
```

Only one concurrent caller can transition a given checkout out of
`{active, validated}`; every other concurrent caller sees `claimed === null`
and either returns the already-created order (if one exists by the time it
looks) or fails with `CHECKOUT_IN_PROGRESS`.

**Bug found and fixed during implementation**: the first version of
`placeOrder` called the public `validateCheckout()` *before* this atomic
claim. `validateCheckout` does its own independent find + mutate + save of
`status`. Under concurrency, N racing `placeOrder` calls each ran their own
`validateCheckout` save, and those saves stomped on each other and on the
atomic claim, such that *no* caller's claim ever matched `{active,
validated}` — verified failure mode: 5 concurrent place-order calls, 0
orders created, all 5 rejected with `CHECKOUT_IN_PROGRESS`. Fixed by
reordering (claim first, validate the already-claimed instance via the pure
`computeIssues` helper) — verified fix: 5 concurrent calls, exactly 1 order
created, exactly 1 real payment-provider `orders.create` call, the other 4
rejected.

## Concurrency: same variant, two different checkouts (last unit)

This is a *different* race — two different customers, two different
checkouts, competing for the same physical stock — and is **not** protected
by the Checkout-level atomic claim above (that only protects one checkout
from itself). It's protected by inventory's own atomic conditional update,
reused unchanged from Phase 5 (`inventoryService.reserveStock`, a single
`findOneAndUpdate` with a `quantityOnHand - quantityReserved >= quantity`
guard). Verified: two checkouts racing for a variant with exactly 1 unit in
stock produced exactly one success and one real `INSUFFICIENT_STOCK`
rejection — never both succeeding, never negative available stock.

## Idempotency

Two independent layers, because they protect against different failures:

- **`Idempotency-Key` header** → stored as `Checkout.idempotencyKey`
  (unique, sparse index). Protects a *retried* request (client timeout,
  network retry) from creating a second attempt even after the original
  request's in-memory claim has already resolved one way or another.
- **The atomic status claim** (previous section) protects concurrent
  *simultaneous* requests, which a unique-key check alone wouldn't catch if
  they all raced before any of them had written the key.

## Pricing

`recomputePricing(checkout)` is the one place `checkout.pricing` gets
written: `subtotal` (sum of line `unitPrice * quantity`, from the
server-side snapshot, never client input) → `taxService.calculateTax` →
`total = max(0, subtotal + shippingCost - discountAmount + taxAmount)`,
rounded with `round2()`. It re-runs after every mutation (address, shipping
method, coupon) so `checkout.pricing.total` is always the current truth,
never a value the client can inject.

## Shipping

`services/shippingService.js` is a flat two-method placeholder (`standard`,
free over ₹500 threshold; `express`, flat ₹149) — a real interface
(`getShippingMethods`, `resolveShippingCost`), intentionally simple
implementation. `setShippingMethod` resolves the id server-side; the client
never sends a shipping cost.

## Tax

`services/taxService.js#calculateTax` returns `{taxAmount: 0, breakdown:
{}}` — an honest zero, not a fake computation, because no real tax regime
has been defined for this business yet. The interface takes
`{subtotal, shippingCost, shippingAddress}` so a real implementation
(state-based GST, for example) can slot in later without touching any
caller.

## Coupons

`services/couponService.js#validateAndApplyCoupon(code, {subtotal})` is the
only path a discount can be created through. The client sends `code`, never
`discountAmount` — there's no field for a client-supplied discount to land
in. Validates: exists + `status: active`, not expired, usage limit not
reached, `subtotal >= minSubtotal`; computes percent-or-fixed discount,
capped at `maxDiscount` and at the subtotal itself (never negative total).
Usage is only recorded (`recordCouponUsage`, `$inc: usedCount`) once an
order is actually created in `placeOrder` — applying a coupon during
checkout doesn't consume it if the customer abandons.

## Address ownership (IDOR)

`resolveAddressInput` looks up `Address.findOne({_id: addressId, user:
userId})` — an address ID belonging to a different user simply isn't found,
same 404 as a nonexistent one (doesn't leak existence). Every checkout
lookup (`requireOwnedCheckout`) is similarly scoped to `{_id, user: userId}`
— there is no way to load, validate, or place-order against another
customer's checkout by guessing an id.

## Order integration

`services/orderService.js#createOrderFromItems` is the single place an
`Order` gets created — extracted so both the legacy `POST /orders` endpoint
and `checkoutService.placeOrder` share one implementation instead of two
copies drifting apart. It resolves live product/variant data, computes
`subtotal`/`totalAmount`, creates the `Order` (`pending`), reserves
inventory per line via `inventoryService.reserveStock`, creates the
Razorpay order, and rolls back (releases reservations, deletes the order)
if any step fails.

## Payment webhook

`POST /payments/webhook/razorpay` (no auth middleware — Razorpay itself is
the caller):

- Verifies `x-razorpay-signature` as HMAC-SHA256 of the *raw* request body
  against `RAZORPAY_WEBHOOK_SECRET`. Fails closed (503) if the secret isn't
  configured — a webhook is never processed unverified.
- Deduplicates via `WebhookEvent.create({provider, providerEventId})` (a
  unique compound index); a duplicate delivery of the same event (providers
  retry) hits `E11000` and is treated as already-handled, not reprocessed.
- `payment.captured` → commits the inventory reservation, marks the order
  `paid`, marks the checkout `completed`.
- `payment.failed` → releases the reservation, cancels the order, marks the
  checkout `failed` (retryable — a new `placeOrder` on the same checkout id
  isn't possible since it's terminal, but the customer can start a fresh
  checkout from their still-intact cart).

## What's explicitly NOT here yet (by design, not oversight)

- **Guest checkout** — every checkout route requires `protect`; unlike
  cart, there's no guest checkout identity. This matches the spec's
  "customer/shipping/billing address requires an authenticated identity"
  requirement.
- **Real tax calculation** — see Tax section above.
- **COD / alternate payment methods** — Razorpay only; a `PaymentService`
  boundary exists in principle (`orderService` talks to Razorpay through a
  single narrow surface) but no second provider is wired in.
- **Checkout expiry sweeping** — `expiresAt` is checked lazily on access
  (`assertNotExpired`), same pattern as Cart/Inventory's expiry handling;
  nothing proactively sweeps expired checkouts on a schedule (no job runner
  in this project, consistent with Phases 5 and 6).
- **Returns, refunds, exchanges** — explicitly out of scope per the Phase 7
  spec; will follow in a later phase once Order/Payment are stable.
