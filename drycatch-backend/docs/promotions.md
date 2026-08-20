# Discounts & Promotions (Phase 11)

## The core rule

There is no `if (coupon === "SAVE10")` anywhere in this codebase. Every
discount — automatic or coupon-gated — flows through one pipeline:
`Promotion → ruleEvaluator (eligibility) → strategy (discount math) →
discountAllocator (per-item split) → merged cart result`. Adding a new
discount type is "write one new strategy file," never touching
`checkoutService`, `orderService`, or `paymentService`.

## Before this phase

Phase 7 shipped a real but deliberately minimal `Coupon` model — flat
`type: "percent"|"fixed"`, one rule set embedded directly on the coupon
itself, no separate "promotion" concept, no per-customer tracking beyond a
global `usedCount`, no product/category targeting, no automatic (no-code)
promotions, and no discount allocation across order lines. That was the
right amount of engineering for what Checkout needed at the time; this
phase replaces it with the real engine the growing feature list requires.

## Promotion vs Coupon

**Promotion** is the actual discount rule (type, conditions, actions,
usage limits, stacking behavior). **Coupon** is a customer-facing code that
*activates* a promotion — a thin pointer, never a second copy of the
discount logic. A promotion can be automatic (`requiresCoupon: false`,
evaluated on every cart with no code needed) or coupon-gated. Coupon codes
are normalized uppercase at the schema level (`uppercase: true` on
`Coupon.code`), so `save10`/`SAVE10`/`Save10` all resolve to the same
document.

## Discount types (strategy pattern)

`services/promotions/strategies/` — `percentageStrategy.js`,
`fixedAmountStrategy.js`, `freeShippingStrategy.js`, and
`buyXGetYStrategy.js` (shared by `BUY_X_GET_Y`/`BUY_X_GET_PERCENTAGE`/
`BUY_X_GET_FIXED_PRICE`, which differ only in what happens to the reward
units within each qualifying set). `strategies/index.js` maps
`Promotion.type` to its calculator — `promotionEngine.js` never branches on
type itself.

## Eligibility (rule engine)

`services/promotions/ruleEvaluator.js` — small composable checks
(`checkDateEligibility`, `checkMinimumSubtotal`, `checkMinimumQuantity`,
`checkCustomerEligibility`, `checkFirstOrder`) plus
`resolveEligibleIndexes`, which determines WHICH cart lines a promotion
actually applies to (product/variant/category targeting, minus explicit
exclusions) — a product-targeted promotion never discounts the whole cart.
`evaluatePromotion` composes these into one eligible/ineligible verdict per
promotion per cart.

## Discount allocation

`services/promotions/discountAllocator.js#allocateDiscount` splits one
lump discount across the specific eligible items proportional to their own
line subtotal, with the last eligible item absorbing the rounding
remainder so allocations always sum to exactly the total discount — never
a penny more or less through float drift. Verified: a ₹130 discount across
a ₹1000 line and a ₹300 line split as ₹100/₹30, summing exactly. This is
what lets a refund later know an item's *actual paid price*, not its
pre-discount price — the allocation is stored on `Order.items[].
discountAmount` at order creation, frozen forever.

## Stacking and priority

`promotionEngine.js#resolveStacking` — deterministic, not database-order-
dependent: an eligible **exclusive** promotion wins alone, discarding every
other candidate. Otherwise, every **stackable** promotion combines, plus
at most one **non-stackable** one (the highest-priority among them) —
so `WELCOME10 + FREESHIP` (both stackable) can combine, but `SAVE20 +
SAVE30` (both non-stackable) never both apply. Verified both branches.

## Real bug found and fixed #1: appliedPromotions cast failure

`Checkout.appliedPromotions` and `Order.promotionSnapshots` were both
originally defined as `[{ promotion: ObjectId, name: String, type: String,
... }]` — a bare object literal inside an array. Mongoose has a classic
ambiguity here: a subdocument array element containing a field literally
named `type` gets misread as a `SchemaTypeOptions` descriptor for the
**whole array** (casting every element to `[String]`) instead of being
recognized as a subdocument schema. Verified failure: applying any coupon
threw `Cast to [string] failed for value "[object Object]"` the moment
`recomputePricing` tried to save the checkout. Fixed by wrapping both
arrays' element definitions in an explicit `new mongoose.Schema({...},
{_id: false})` — which removes the ambiguity — rather than renaming the
field (`type` is the correct, meaningful name here: it's the promotion
type). Reverified: applying a coupon and completing checkout both work.

## Real bug found and fixed #2: per-customer limit not checked at apply time

`checkoutService.applyCoupon`'s preflight originally only checked the
coupon's **global** usage count before accepting a coupon for display —
not whether *this customer* had already used it. The atomic, race-safe
enforcement in `redemptionService.js` (see below) was always correct, but
a customer who'd already used a once-per-customer coupon would see it
"apply successfully" at checkout, only to have `placeOrder` reject it
later with `COUPON_CUSTOMER_LIMIT_REACHED` — a working-but-confusing UX.
Verified failure: `applyCoupon` returned success on a coupon already
redeemed by that customer. Fixed by adding a `CouponCustomerUsage` lookup
to the preflight (`promotionEngine.js#checkUsagePreflight`), so an
already-used coupon is rejected immediately with a clear message.
Reverified: the second `applyCoupon` attempt now fails immediately with
`COUPON_CUSTOMER_LIMIT_REACHED`.

## Concurrency — the mandatory "last coupon use" test

Two *different* customers racing for the last use of a `usageLimit: 1`
coupon: exactly one succeeds. `redemptionService.js#redeemCoupon` uses the
same atomic-conditional-update pattern as Phase 5's inventory reservation
and Phase 7's checkout claim — `Coupon.findOneAndUpdate({_id, status:
"active", $expr: {$lt: ["$usageCount", limit]}}, {$inc: {usageCount: 1}})`
— only one racing caller's update can match. Verified: 2 concurrent
`placeOrder` calls on separate checkouts for the same `usageLimit: 1`
coupon → exactly 1 succeeded, 1 rejected with `COUPON_USAGE_LIMIT_REACHED`,
final `usageCount: 1`.

Per-customer limits use the identical shape but a *separate* single-purpose
document — `CouponCustomerUsage` (`{coupon, customer, count}`, unique
compound index) — kept apart from `CouponRedemption` (the audit trail)
specifically so the row two concurrent requests might both touch stays
small and fast, not mixed with a growing history log. The
increment-or-create pattern (`incrementCustomerUsage`) is race-safe for
*any* limit value, not just 1: a conditional `findOneAndUpdate` handles the
already-exists-and-under-limit case; the unique index makes the
doesn't-exist-yet race resolve to exactly one winner via `create`+catch
`E11000`.

## Redemption lifecycle — applied vs redeemed

A coupon entered at checkout is only **applied** (display/pricing only,
via `evaluateCart`) — it is not consumed. It becomes **redeemed** only
inside `checkoutService.placeOrder`, inside the same exclusive claim
Phase 7's atomic checkout-claim already holds, right alongside inventory
reservation. `CouponRedemption` records the outcome (`redeemed` /
`released` / `cancelled`); `CouponCustomerUsage`/`Coupon.usageCount` are
the actual atomic counters.

**Release policy** (rule #28/#29, explicitly decided rather than left
ambiguous): a redemption is released — usage counters decremented, coupon
becomes reusable again — when the order fails **before payment succeeds**:
order-creation failure, payment failure (`paymentService.markFailed`), or
a pre-payment customer cancellation (`orderController.cancelOrder`, only
on the branch where `paymentStatus !== "succeeded"`). **Once payment has
succeeded, the redemption is permanent** — a later cancellation or refund
does not release it. This mirrors how real-world coupon programs usually
work (a redemption against a completed purchase isn't undone by a later
return) and keeps the policy unambiguous rather than "maybe, depends."
Verified: releasing a redemption correctly zeroed both `Coupon.usageCount`
and the matching `CouponCustomerUsage.count`, and the same coupon could
then be reapplied successfully.

## Order snapshot / immutability

`Order.promotionSnapshots` (name, type, discountAmount, freeShipping, the
redemption id) and the existing `Order.couponSnapshot`/`items[].
discountAmount` are frozen at order creation — an admin editing or
archiving a `Promotion` tomorrow does not alter what a past order shows,
same immutability guarantee Phase 9 established for order line snapshots.

## Tax/discount ordering

Per rule #58's explicit example (`Subtotal − Discount = Taxable Amount +
Tax = Total`), `recomputePricing` now computes tax on
`subtotal - discountAmount`, not on the pre-discount subtotal. This has no
visible effect yet since `taxService.calculateTax` still returns an honest
zero (Phase 7), but the ordering is now the documented, intentional policy
rather than an unstated assumption.

## Rate limiting

`POST /checkout/:id/coupon` sits behind a dedicated limiter (30/15min per
IP) separate from the blanket `apiLimiter`, same shape as the auth
endpoints' tighter throttle — coupon codes are an enumeration/brute-force
target (rule #70/#71).

## Admin APIs

`/admin/promotions` (CRUD + activate/pause/archive) and `/admin/coupons`
(create/list/activate/pause) — both `adminOnly`. No dedicated
MARKETING/SUPPORT RBAC role exists in this project (same honest limitation
noted since Phase 9) — everything sits behind the existing customer/admin
split.

## What's explicitly NOT here yet (by design, not oversight)

- **Coupon reservation with expiry** (rule #91/#92) — this system's
  redemption model doesn't hold a coupon "reserved" during an in-flight
  checkout; it's claimed atomically at `placeOrder`, which (thanks to
  Phase 7's checkout TTL and atomic claim) is a short-lived window anyway.
  A true reserve-then-confirm model with a background expiry sweep isn't
  built — no job scheduler exists in this project (same limitation noted
  since Phase 5).
- **Customer segments** (`NEW_CUSTOMER`/`VIP`/etc.) — `firstOrderOnly` is
  implemented (checked against real order history, never client state);
  broader segmentation is left as a clean extension point
  (`ruleEvaluator.checkCustomerEligibility` already isolates this concern)
  rather than built out with fake segments.
- **Bulk coupon generation, unique-per-customer coupon codes** — the data
  model (`Coupon.code` unique, `createdBy`) supports generating many codes
  against one `Promotion`, but no bulk-generation endpoint exists.
- **Promotion preview against a sample cart** — `promotionEngine.
  evaluateCart` already accepts an arbitrary `items` array, so building a
  preview endpoint later is straightforward, but none exists yet.
- **A `Coupon → validate` endpoint separate from apply** — this project's
  established Checkout pattern (Phase 7) is validate-and-apply-in-one-call;
  `applyCoupon` does both, matching the existing convention rather than
  adding a parallel validate-only endpoint.
