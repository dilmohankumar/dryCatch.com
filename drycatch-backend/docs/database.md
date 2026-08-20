# Database

MongoDB via Mongoose. All schemas use `timestamps: true`.

## Models

**User** — `email` (unique), `password` (bcrypt, `select: false`), `role`
(`customer`/`admin`), `status` (`active`/`deactivated`/`blocked` — the third
value is Phase 14, additive not a rename; `deactivated` stays the
reversible customer-initiated self-service state, `blocked` is the
admin-initiated equivalent, kept as a distinct value so an audit-log entry
is never ambiguous about who took the account offline), `otp`/`otpExpires`
(`select: false`), `wishlist[]` (ref Product). Addresses moved to their own
collection (below); cart moved to its own `Cart`/`CartItem` collections
(Phase 6, below) so a guest — someone with no `User` document at all — can
still have a cart.

`adminRole` (Phase 14, ref `Role`, optional — only meaningful when `role ===
"admin"`) — the granular RBAC role layered on top of, not replacing, this
coarse `role` field; see **Role** below. `blockedAt`/`blockedBy` (ref User)/
`blockReason` (Phase 14) — set only when `status` transitions to
`"blocked"`, cleared on unblock.

**Address** — `user` (ref User), `type` (`shipping`/`billing`/`both`),
`fullName`, `phone`, `addressLine1/2`, `landmark`, `city`, `state`,
`postalCode`, `country`, `isDefaultShipping`, `isDefaultBilling` (tracked
independently — a shipping default and a billing default can be different
addresses). Moved out of `User` so `Order.shippingAddress` can keep
snapshotting purchase-time fields without depending on a mutable/deletable
subdocument. Indexes: `{ user: 1 }`, `{ user: 1, isDefaultShipping: 1 }`,
`{ user: 1, isDefaultBilling: 1 }`.

**UserPreferences** — `user` (ref User, unique), `marketingEmail`,
`marketingSms`, `productRecommendations`, `backInStockAlerts`. Deliberately
excludes order/security notifications — those aren't marketing and
shouldn't be silenceable the same way.

**Product** — `name`, `slug` (unique, stable public identity — see
`utils/slugify.js`), `status` (`draft`/`active`/`inactive`/`archived` —
lifecycle), `visibility` (`public`/`hidden` — separate merchandising
concern from status), `category` (ref Category), `collections[]` (ref
Collection), `tags[]`, `attributes` (Map, structured key/value — e.g.
`origin`, `species`, `preparation` — instead of hardcoded columns per
attribute), `shortDescription`/`description` (resolved the old `desc`
duplication: `desc` is gone, `shortDescription` is for cards/listing,
`description` is the full detail-page copy), `price`, `mrp`, `discountPct`
(derived in a pre-save hook, not client-writable — powers a real
server-side "sort by discount"), `media[]` (`{ type, url, alt, sortOrder }`),
`slides[]` (legacy plain-URL fallback, new writes use `media`), `seo`
(`{ title, description, keywords[] }`), `featured`. `price`/`mrp` here are
now a *display fallback* only (e.g. before a product's variants have
loaded) — the purchasable unit and its real price live on `ProductVariant`
(below); Product no longer carries an embedded `variants[]` array.
Text index on `{ name, shortDescription, description }`.

`rating`/`reviewsCount` (Phase 12) — kept as the pre-existing fields for
backward compatibility, but now actually populated and **derived**, never
recomputed by scanning `Review` documents: `ratingSum` (running total,
makes the average an O(1) `ratingSum / reviewsCount` division rather than a
re-aggregation on every read), `ratingDistribution` (`{1-5: count}`),
`verifiedReviewCount`, `photoReviewCount`. All five are touched only via
`$inc` deltas in `ratingAggregationService.js#applyRatingDelta` — see
**Review** below.

**ProductVariant** (Phase 4) — `product` (ref Product, required), `sku`
(globally unique, immutable after creation — see `docs/api.md#variants`),
`weight` (`{ value: Number, unit: enum(g,kg,ml,l,piece,pack) }` — structured,
not just a display string, so price-per-kg/shipping/filtering don't need a
later migration), `attributes` (Map, for any other dimension — packaging,
flavor, etc.), `combinationKey` (derived from normalized weight+attributes;
enforces "no two variants of one product represent the same real-world
combination" via a DB unique index, not just app-level checking), `price`,
`mrp`, `discountPct` (derived), `status`
(`draft`/`active`/`inactive`/`archived` — independent of the parent
Product's status), `visibility`, `isDefault` (exactly one deterministic
default per product — the first variant created, or explicitly reassigned
on archive), `sortOrder`, `media[]`.

**Category** — `name`, `slug` (unique), `description`, `image`, `parent`
(self-ref, for a category tree), `status` (`active`/`archived`),
`sortOrder`, `seo`.

**Collection** — `name`, `slug` (unique), `description`, `image`, `status`,
`sortOrder`, `seo`. Merchandising groupings (Best Sellers, New Arrivals) —
deliberately kept separate from `Category` (taxonomy). A product can belong
to many collections and still have just one category.

**Order** — `orderNumber` (Phase 9, unique — `DC-<year>-<6-digit seq>`, see
`utils/orderNumber.js`; the human/support-facing identifier, backed by
`OrderCounter` below; the Mongo `_id` remains the internal reference
everywhere else), `user` (ref User), `checkout` (ref Checkout, Phase 7 —
set when the order came through the Checkout session flow rather than the
older direct-create path, so a webhook/verify call can find the
originating checkout and advance its state machine too), `items[]` (`{
product, variant (ref ProductVariant, optional), sku, name, variantLabel,
price, quantity }` — price/sku/variantLabel are all snapshotted from the
variant at purchase time, never re-derived from current catalog data
later), `currency` (Phase 9, default `"INR"`), `subtotal`,
`shippingMethod`, `shippingCost`, `taxAmount`, `discountAmount`,
`couponCode` (Phase 7 — kept as separate fields, not folded into
`totalAmount`, so an order's summary can show a real breakdown: `subtotal
+ shippingCost + taxAmount - discountAmount = totalAmount`),
`couponSnapshot` (Phase 9, `{ code, discountAmount }` — a richer snapshot
than `couponCode` alone, so a later change to the coupon's own config can't
retroactively make an old order's discount look unexplained),
`promotionSnapshots[]` (Phase 11 — `{ promotion, name, type, discountAmount,
freeShipping, redemption }`, one entry per promotion/coupon that actually
applied, frozen at order creation so editing/archiving a `Promotion`
tomorrow never alters what a past order shows), `totalAmount`,
`shippingAddress`, `billingAddress` (Phase 7 — previously only
`shippingAddress` existed).

`items[]` gained `discountAmount` in Phase 11 — that line's allocated
share of the order's total discount (`services/promotions/discountAllocator.js`),
so a refund/return can compute an item's *actual paid price*, not its
pre-discount price. `promotionSnapshots` and this per-item `discountAmount`
are both additive to Phase 9's schema, not a rename.

**A Mongoose gotcha found and fixed in Phase 11**: `promotionSnapshots[]`
was originally a bare object literal (`[{ promotion, name, type: String,
... }]`). A subdocument-array element containing a field literally named
`type` is a classic Mongoose ambiguity — it gets misread as a
`SchemaTypeOptions` descriptor for the *whole array* (casting every element
to `[String]`) instead of a subdocument schema. Fixed by wrapping the
element definition in an explicit `new mongoose.Schema({...}, {_id:
false})`, which removes the ambiguity. `Checkout.appliedPromotions` (below)
has the identical fix for the identical reason. **Worth checking before
adding any future array-of-subdocuments field in this codebase that
includes a field named `type`.**

Three separate status dimensions (Phase 9 — never one field doing three
jobs): `status` (the business/commercial lifecycle enum — see below),
`paymentStatus` (`pending`/`processing`/`succeeded`/`failed`/`refunded`/
`partially_refunded` — mirrors `Payment.status`, Phase 8, directly on the
order for cheap reads without a join), `fulfillmentStatus`
(`not_started`/`processing`/`packed`/`partially_shipped`/`shipped`/
`out_for_delivery`/`partially_delivered`/`delivered` — the shipping-relevant
subset, kept on `Order` directly rather than derived live from
Fulfillment/Shipment on every read). `partially_shipped`/`partially_delivered`
are Phase 10 additions — **additive to Phase 9's enum, not a rename**
(unlike Phase 9's own breaking `status` rename below) — reached when an
order has more than one `Shipment` and they aren't all at the same stage
(`services/orderFulfillmentSync.js#syncOrderFulfillmentState` recomputes
this from every shipment across every fulfillment on the order, never from
one shipment's webhook in isolation). Also
`idempotencyKey` (Phase 9, unique, sparse — a repeated `createOrderFromItems`
call with the same key returns the existing order instead of creating a
duplicate; covers the legacy direct `/orders` path independently of
Checkout's own atomic claim), and the Razorpay order/payment/signature
fields. Indexes: `{ user: 1, createdAt: -1 }` (the "my orders" list query),
`{ status: 1, createdAt: -1 }`, `{ paymentStatus: 1 }`,
`{ fulfillmentStatus: 1 }`.

> **Breaking change (Phase 9) — `Order.status` enum renamed, not extended.**
> The old seven-value enum (`pending, paid, processing, shipped, delivered,
> cancelled`) is gone, replaced by a new twelve-value enum: `pending_payment,
> payment_processing, confirmed, processing, packed, shipped,
> out_for_delivery, delivered, cancelled, return_requested, returned,
> refunded`. This isn't additive — `pending` and `paid` no longer exist as
> values at all (`paid` was really a payment fact wearing an order-status
> hat; that's now `paymentStatus: "succeeded"`). Any pre-existing `Order`
> document with an old string value (`"pending"`, `"paid"`, etc.) would fail
> schema validation on save and wouldn't match any state-machine transition
> in `utils/orderStateMachine.js` — **a migration backfilling old values to
> the new enum (and deriving `paymentStatus`/`fulfillmentStatus` from them)
> would be required before this could run against real order data.** Not
> applied here because no production data exists yet (same reasoning as the
> Phase 4 variant and Phase 6 cart cutovers below).
>
> `return_requested`/`returned`/`refunded` are reserved for a future Returns
> phase — the values exist now so the schema doesn't need a second breaking
> migration later, but no code transitions into them yet.
>
> `PUT /orders/:id/status` (admin) is the only place `status` is ever
> admin-settable, and every transition is validated against the explicit
> adjacency list in `utils/orderStateMachine.js#assertValidTransition`
> (throws `INVALID_ORDER_TRANSITION`, 409) — no more blind `$set`.

**OrderEvent** (Phase 9) — the append-only audit timeline for one order:
`order` (ref Order), `type` (`ORDER_CREATED`/`PAYMENT_CONFIRMED`/
`PAYMENT_FAILED`/`REFUND_COMPLETED`/`REFUND_PARTIAL`/`ORDER_CANCELLED`/
`ORDER_STATUS_CHANGED`/...), `fromStatus`, `toStatus`, `message`,
`actorType` (`CUSTOMER`/`ADMIN`/`STAFF`/`SYSTEM`/`PAYMENT_PROVIDER`/
`WAREHOUSE`/`DELIVERY_SYSTEM`, required), `actorId` (ref User, absent for
`SYSTEM`/`PAYMENT_PROVIDER`), `metadata` (Mixed). Never updated or deleted
once written — `services/orderEventService.js#recordOrderEvent` is the only
way one gets created. Powers `GET /orders/:id/timeline`. Index:
`{ order: 1, createdAt: 1 }`.

**OrderCounter** (Phase 9) — backs `orderNumber` generation: `_id` (string,
e.g. `"order_2026"` — one document per year), `seq` (incremented via an
atomic `findOneAndUpdate` + `$inc`, never "read the max and add one," which
would race under concurrent order creation). See `utils/orderNumber.js`.

**Review** (Phase 12, **rewritten** — see Migration note below) — `product`
(ref Product), `variant` (ref ProductVariant, optional), `user` (ref User),
`order` (ref Order, set only by `reviewEligibilityService`, never accepted
from the client), `isVerifiedPurchase`, `productNameSnapshot`/
`variantNameSnapshot` (frozen at creation — a later product rename doesn't
rewrite what the review historically referenced), `rating` (integer 1-5),
`title`/`body` (sanitized via `utils/sanitizeText.js` before save — all HTML
tags and `javascript:` URIs stripped), `status`
(`pending`/`published`/`rejected`/`hidden`/`deleted` — soft-delete only,
never a real removal), `publishedAt`, `moderatedBy`/`moderationReason`,
`helpfulCount`/`notHelpfulCount`, `featured` (admin-only, never
frontend-settable). Indexes: unique `{ product: 1, user: 1 }` (below),
`{ product: 1, status: 1, createdAt: -1 }` (the public review-list query),
`{ user: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }` (admin
moderation queue).
>
> **One review per product per customer, ever** — `unique {product, user}`
> index. Editing is how an opinion changes; soft-deleting still leaves the
> document behind (`status: "deleted"`), so a customer cannot re-review
> after deleting either — a deliberate policy decision (a single race-safe
> DB constraint beats an app-level check-then-create with a race window),
> not an oversight.
>
> `Product.rating`/`reviewsCount` are never recomputed by scanning `Review`
> documents — see `ratingSum`/`ratingDistribution` under **Product** above
> and `ratingAggregationService.js` below.

**ReviewVote** (Phase 12) — `review` (ref Review), `user` (ref User),
`vote` (`helpful`/`not_helpful`). Unique `{ review: 1, user: 1 }` —
`reviewVoteService.js#castVote` upserts against this index (switching
Helpful→Not Helpful updates the existing row, never creates a second one),
and keeps `Review.helpfulCount`/`notHelpfulCount` in sync via `$inc` deltas,
not a recount.

**ReviewReport** (Phase 12) — `review` (ref Review), `user` (ref User),
`reason` (`spam`/`offensive`/`fake_review`/`irrelevant`/`abusive`/`other`),
`description`, `status` (`open`/`under_review`/`resolved`/`dismissed`),
`resolvedAt`/`resolvedBy`. Unique `{ review: 1, user: 1 }` — prevents the
same customer reporting the same review twice while it's still active.

**ReviewMedia** (Phase 12) — `review` (ref Review), `type`
(`image`/`video`), `url`, `storageKey`, `mimeType`, `size`, `width`,
`height`, `duration` (video only), `status`
(`uploading`/`processing`/`ready`/`rejected`). Real limits (5 images / 1
video per review, MIME allow-list, size caps) but **no object storage is
integrated anywhere in this project** (same honest-stub pattern as Phase
8's Stripe adapter and Phase 10's Shiprocket adapter) — `url`/`storageKey`
are supplied by the caller, not generated by an actual presigned-upload
flow. Index: `{ review: 1 }`.

`ratingAggregationService.js#applyRatingDelta` is the only place
`Product.rating`/`reviewsCount`/`ratingDistribution`/`verifiedReviewCount`/
`photoReviewCount` are ever touched — always via `$inc` deltas describing
what changed (a review published, unpublished, or an already-published
review's rating edited), never a blind overwrite or a full scan of every
`Review` for that product. Only `published` reviews ever count toward the
aggregate.

**InventoryLocation** (Phase 5) — `name`, `code` (unique — `"MAIN"` today).
Deliberately minimal; a second warehouse is a new document, not a schema
change, since every inventory record already keys off `{variant, location}`.

**Inventory** — `variant` (ref ProductVariant), `location` (ref
InventoryLocation), `quantityOnHand`, `quantityReserved`, `reorderLevel`,
`status`. `quantityAvailable` is a **virtual**, not a stored field —
`onHand - reserved`, computed at read time so it can never drift out of
sync with the two numbers it's derived from. Unique `{variant, location}` —
the core integrity rule this whole system depends on (inventory belongs to
the variant, never the product).

**InventoryReservation** — a temporary hold between checkout and payment
resolution: `variant`, `location`, `quantity`, `referenceType`/`referenceId`
(what it's for — an order attempt), `status`
(`active`/`committed`/`released`/`expired`), `expiresAt`. Unique
`{referenceType, referenceId, variant}` — the idempotency guard that makes
a duplicated checkout request a no-op instead of a double reservation.

**StockMovement** — the audit ledger. `variant`, `location`, `type`
(`PURCHASE_RECEIPT`/`MANUAL_ADJUSTMENT`/`SALE`/`RETURN`/`DAMAGE`/
`RESERVATION`/`RELEASE`), signed `quantity`, `referenceType`/`referenceId`,
`reason`, `createdBy`. Partial-unique `{referenceType, referenceId, variant,
type}` (only when `referenceId` is set) — the same reference+variant+type
combination can never produce two movement rows, so a retried commit/release
can't double-record.

**Cart** (Phase 6) — belongs to EITHER `user` OR `guestId` (a random UUID
in an httpOnly cookie), never both. `status`
(`active`/`converted`/`abandoned`/`expired`), `currency`, `expiresAt`
(guest carts only). Deliberately carries no stored subtotal/total — those
are always recalculated from live `CartItem` + `ProductVariant` +
`Inventory` data on read (see `docs/cart.md`), so a stale persisted total
can never happen. Unique partial indexes on `{user,status:"active"}` and
`{guestId,status:"active"}` — at most one active cart per identity, enforced
by MongoDB.

**CartItem** — `cart` (ref), `variant` (ref ProductVariant, required — a
cart line is always a variant, never a bare product), `quantity`,
`priceSnapshot` (display/history only; the authoritative price is always
read fresh from `ProductVariant` at cart-read and at checkout). Unique
`{cart, variant}` — one line per variant per cart, enforced by MongoDB so a
race can never produce two "500g" lines.

**Checkout** (Phase 7) — a dedicated session between Cart and Order, not
the same thing as either (see `docs/checkout.md`). `user` (ref User),
`cart` (ref Cart), `order` (ref Order, set once `placeOrder` succeeds),
`status` enum (`active`/`validated`/`inventory_reserved`/
`payment_pending`/`completed`/`expired`/`cancelled`/`failed` — the state
machine), `currency`, `items[]` (`{ product, variant, sku, name,
variantLabel, quantity, unitPrice }` — `unitPrice` snapshotted at the last
`validate()` call, not client input), `shippingAddress`/`billingAddress`
(snapshot subdocuments: `line1/2, city, state, pincode, phone, fullName`),
`billingSameAsShipping`, `shippingMethodId`, `shippingCost`, `couponCode`,
`discountAmount`, `freeShipping` (Phase 11, boolean — true when any applied
promotion grants free shipping), `appliedPromotions[]` (Phase 11 —
`{ promotion, name, type, discountAmount, source }`, transient/recomputed
on every pricing pass by `promotionEngine.evaluateCart`, exposed to the
frontend's discount breakdown, frozen onto `Order.promotionSnapshots` at
`placeOrder` — same `new mongoose.Schema({...}, {_id: false})` wrapper
`Order.promotionSnapshots` uses, and for the identical reason: a field
named `type` inside a bare array-of-objects literal breaks Mongoose), item
`discountAmount` (Phase 11, per-line allocation), `taxAmount`, `pricing`
(`{ subtotal, discount, shipping, tax, total }` — the one place a computed
total lives, written only by `recomputePricing`; `shipping` already
reflects `freeShipping`, and Phase 11 changed tax to compute on
`subtotal - discountAmount`, not the pre-discount subtotal, per the
documented tax/discount ordering policy in `docs/promotions.md`),
`idempotencyKey` (unique, sparse — only enforced when a client actually
sends an `Idempotency-Key` header, guarding a retried/duplicated
`place-order` call against creating a second order), `expiresAt` (20
minutes from creation; checked lazily on access, same pattern as
Cart/Inventory expiry — nothing sweeps proactively). Indexes: `{ user: 1,
status: 1 }`, `{ expiresAt: 1 }`.

**Coupon** (Phase 7, **rewritten in Phase 11** — breaking schema change,
see Migration note below) — a customer-facing code that activates a
`Promotion`, no longer a second copy of the discount rule. `code` (unique,
uppercase, trimmed), `promotion` (ref Promotion, required), `status`
(`active`/`paused`/`archived`), `usageLimit`/`usageCount`/
`perCustomerLimit`/`startAt`/`endAt` (all optional *overrides* — undefined
means "use the linked Promotion's own value"), `createdBy`. Phase 7's flat
`type`/`value`/`minSubtotal`/`maxDiscount`/`usedCount`/`expiresAt` fields
are gone entirely. Indexes: `{ promotion: 1 }`, `{ status: 1 }`.

**Promotion** (Phase 11) — the actual discount rule Coupon merely points
to. `name`, `description`, `type` (`PERCENTAGE`/`FIXED_AMOUNT`/
`FREE_SHIPPING`/`BUY_X_GET_Y`/`BUY_X_GET_PERCENTAGE`/
`BUY_X_GET_FIXED_PRICE` — dispatched to a matching strategy in
`services/promotions/strategies/`, never branched on inline), `status`
(`active`/`paused`/`archived` — `DRAFT`/`SCHEDULED`/`EXPIRED` are all
*derived* at read time from `status` + `startAt`/`endAt`, never stored),
`priority` (higher wins when promotions conflict), `startAt`/`endAt`,
`conditions` (`{ minSubtotal, minQuantity, productIds, variantIds,
categoryIds, excludedProductIds, excludedCategoryIds, customerIds,
firstOrderOnly }`), `actions` (`{ value, maxDiscount, buyQuantity,
getQuantity, getDiscountPercent, getFixedPrice }`), `requiresCoupon`
(`false` = automatic, evaluated on every cart with no code), `usageLimit`/
`usageCount`/`perCustomerLimit`, `stackable`/`exclusive` (rules #40-42's
deterministic conflict resolution — see `docs/promotions.md`),
`createdBy`. Indexes: `{ status: 1, startAt: 1, endAt: 1 }` (the automatic-
promotion candidate query), `{ priority: -1 }`, `{ requiresCoupon: 1,
status: 1 }`.

**CouponRedemption** (Phase 11) — the audit trail, one row per coupon/
promotion use regardless of outcome. `coupon` (ref Coupon, optional — an
automatic promotion has no coupon at all), `promotion` (ref Promotion),
`customer` (ref User), `order` (ref Order, set once the order exists),
`checkout` (ref Checkout), `discountAmount`, `status`
(`redeemed`/`released`/`cancelled`), `redeemedAt`. Indexes: `{ coupon: 1 }`,
`{ customer: 1 }`, `{ order: 1 }`.

**CouponCustomerUsage** (Phase 11) — the actual atomic per-customer-limit
concurrency guard, deliberately separate from `CouponRedemption`'s growing
history log so the one document two concurrent requests might race to
touch stays small and fast. `coupon`, `customer`, `count`. Unique compound
index `{ coupon: 1, customer: 1 }` — the increment-or-create pattern in
`redemptionService.js#incrementCustomerUsage` is race-safe for *any* limit
value via a conditional `findOneAndUpdate` (existing under-limit doc) plus
`create` + catch `E11000` (doesn't-exist-yet race, exactly one winner).

**Payment** (Phase 8) — the current payment state for one order: `order`
(ref Order), `checkout` (ref Checkout, optional), `user` (ref User),
`provider` (`"razorpay"`/`"stripe"`), `providerPaymentId`/`providerOrderId`
(set once the provider confirms), `amount`/`currency` (minor units,
server-computed from `Order.totalAmount` — never client input), `status`
(`created → pending → processing → succeeded | failed | cancelled |
expired`, plus `refunded`/`partially_refunded` reached only from
`succeeded`), `method`, `failureCode`/`failureMessage`, `refundedAmount`.
Indexes: `{ order: 1 }`, `{ user: 1, createdAt: -1 }`, unique sparse
`{ providerOrderId: 1 }`, unique sparse `{ providerPaymentId: 1 }` —
**single-field**, not compound with `provider`. A real bug was found and
fixed here: a compound sparse index (`{provider, providerOrderId}`) only
excludes a document from the index when *all* listed fields are missing —
since `provider` is always set, two `Payment` docs both missing
`providerPaymentId` (the normal state right after creation) were both
indexed as `{provider:"razorpay", providerPaymentId:null}` and collided
(`E11000`) on the second insert. Single-field sparse indexes correctly
exclude any document missing that one field regardless of what else is
set — see `docs/payments.md` for the full writeup.

**PaymentAttempt** (Phase 8) — one row per distinct attempt to pay for an
order (`payment` ref, `order` ref, `provider`, `providerReference`,
`amount`/`currency`, `status` enum, `attemptNumber`,
`failureCode`/`failureMessage`). Kept separate from `Payment` so a retry
doesn't overwrite history — "attempt 1 failed, attempt 2 succeeded" needs
to survive as two rows, not one field clobbered. `idempotencyKey` (unique,
sparse) holds the client's `Idempotency-Key` **namespaced** as
`` `${idempotencyKey}:${order._id}` `` rather than the raw key — a client
may legitimately resend the same key across retries of one checkout
attempt, but each successful checkout claim produces a new `Order`; without
the order-id namespace a stale key from an earlier, rolled-back attempt
could wrongly be treated as a duplicate of a later, unrelated order.
Indexes: unique `{ order: 1, attemptNumber: 1 }`, `{ payment: 1 }`, unique
sparse `{ idempotencyKey: 1 }`.

**Refund** (Phase 8) — one row per refund operation: `payment` (ref),
`order` (ref), `provider`, `providerRefundId`, `amount` (minor units,
bounded by `payment.amount - payment.refundedAmount` at creation),
`currency`, `status` (`pending`/`succeeded`/`failed`), `reason`,
`idempotencyKey` (unique, sparse — an admin's double-clicked refund button
must not create two provider refunds, unscoped by order unlike
`PaymentAttempt.idempotencyKey` since a refund always targets one
already-fixed payment). Indexes: `{ payment: 1 }`, unique sparse
`{ providerRefundId: 1 }` — same single-field-not-compound reasoning as
`Payment` above.

**Warehouse** (Phase 10) — `name`, `code` (unique, e.g. `"MUM-01"`),
`address` (`{ line1/2, city, state, pincode, phone }`), `status`
(`active`/`inactive`). Deliberately minimal (rule #27); its existence as a
real referenced model rather than a free-text string on `Fulfillment` is
what lets multi-warehouse fulfillment slot in later without a schema change.

**Fulfillment** (Phase 10) — "what items are being prepared, from which
warehouse?", deliberately separate from `Shipment` ("which physical package
went out"). `order` (ref Order), `warehouse` (ref Warehouse), `status`
(`pending`/`allocated`/`picking`/`packing`/`ready_to_ship`/`shipped`/
`completed`/`cancelled`) — `shipped`/`completed` are only ever set
internally by `shipmentService`, never a direct admin action. An order can
have more than one Fulfillment (different warehouses); one Fulfillment can
produce more than one Shipment, though the default flow this phase exercises
end-to-end is 1:1. Indexes: `{ order: 1, status: 1 }`,
`{ warehouse: 1, status: 1 }`.

**FulfillmentItem** (Phase 10) — links a Fulfillment back to specific order
lines: `fulfillment` (ref), `product` (ref), `variant` (ref ProductVariant),
`sku`, `name`, `quantity` (ordered qty assigned to this fulfillment),
`fulfilledQuantity` (packed/shipped so far). Since `Order.items` are
embedded subdocuments without their own `_id` (Phase 7/9), the link back to
"which order line" is by `variant` within the order rather than a
subdocument foreign key — sufficient because an order never carries the
same variant on two separate lines. Index: `{ fulfillment: 1 }`.

**Shipment** (Phase 10) — "which physical package went out, through which
carrier": `order` (ref), `fulfillment` (ref), `warehouse` (ref), `carrier`
(string, resolved via `carrierFactory`), `carrierShipmentId`,
`trackingNumber`, `trackingUrl`, `status` (`created` →`label_created` →
`ready_for_pickup` → `picked_up` → `in_transit` → `{out_for_delivery,
delivered, delivery_failed}`, plus `rto_*` and `cancelled`; `label_failed` is
a recoverable side-state), `shippingMethod`, `customerShippingCharge` (what
the customer paid, from `Order.shippingCost`) vs `carrierShippingCost` (what
the carrier actually charges — rule #52, never shown to the customer, kept
as a separate field on purpose), `labelUrl`, `labelGeneratedAt`,
`estimatedDeliveryFrom/To`, `shippedAt`, `deliveredAt`, `failureReason`,
`idempotencyKey` (unique, sparse — a repeated "Create Shipment" click with
the same key returns the existing shipment instead of opening a second
carrier one). Indexes: `{ order: 1 }`, `{ fulfillment: 1 }`, `{ status: 1 }`,
unique sparse `{ trackingNumber: 1 }`, unique sparse
`{ carrierShipmentId: 1 }` — **single-field, not compound with `carrier`**,
the same fix applied here proactively that Phase 8 had to find and fix on
`Payment`/`Refund` after the fact: a compound sparse index
(`{carrier, trackingNumber}`) only excludes a document from the index when
*every* listed field is missing, and `carrier` is always set, so two
shipments both missing `trackingNumber` (the normal pre-label-generation
state) would still collide as `{carrier:"mock", trackingNumber:null}`.
Single-field sparse indexes correctly exclude any document missing that one
field regardless of what else is set. The tradeoff: this makes
`trackingNumber`/`carrierShipmentId` global-unique rather than
per-carrier-unique (in reality a tracking number is only unique within one
carrier) — accepted deliberately as the safe side of that tradeoff until
multiple carriers are actually live.

**ShipmentItem** (Phase 10) — links a Shipment to `FulfillmentItem`s with
its own `quantity`: `shipment` (ref), `fulfillmentItem` (ref), `variant`
(ref), `sku`, `name`, `quantity`. Needed because one order line (e.g.
"Product A × 3") can legitimately split across two shipments ("A × 1" in
one, "A × 2" in another) — shipped quantity has to be tracked independently
of both the order line and the fulfillment line. Index: `{ shipment: 1 }`.

**ShipmentEvent** (Phase 10) — append-only tracking history, never
overwritten: `shipment` (ref), `status` (normalized internal value, e.g.
`in_transit`), `location`, `description`, `eventTime` (when the carrier says
it happened — kept separate from `createdAt`, when this system recorded it,
since carrier events can arrive late), `source`
(`carrier_webhook`/`carrier_poll`/`admin`/`system`), `metadata` (Mixed, raw
webhook payload). Index: `{ shipment: 1, eventTime: 1 }`.

**ProductSearchIndex** (Phase 13) — a denormalized read-projection for
search, not a new source of truth: `Product` remains authoritative, this
collection is what `mongoSearchProvider.js` actually queries (see
`docs/search.md`). One document per product (`product` ref, unique), with
only discovery-relevant fields: `name`, `slug`, `shortDescription`,
`description`, `category`/`categoryId`/`categoryPath` (denormalized
display label + id, not just an id — facets need a label), `tags[]`,
`keywords[]` (admin/derived, distinct from `tags`), `sku[]` (every variant
SKU, for exact-SKU search), `variants[]` (`{variantId, label, price, sku,
inStock}`), `attributes` (Mixed, flattened for faceting), `price`/
`minPrice`/`maxPrice`/`currency`, `rating`/`reviewCount` (fed from Phase
12's rating aggregate), `inventoryStatus`, `popularity`/`salesCount`
(coarse signals, refreshed by reindex/reconcile, not on every sale),
`isActive`/`isPublished` (mirror `Product.status === "active"` /
`visibility === "public"` — the hard gate every provider query filters on),
`featured`. Weighted Mongo `$text` index: `name: 10, category: 6, tags: 4,
keywords: 4, shortDescription: 2, description: 1` — not every field is
equally relevant (rule #7/#8). Plus keyword/numeric indexes for faceting,
never analyzed text: `{categoryId: 1}`, `{price: 1}`, `{rating: -1}`,
`{isActive: 1, isPublished: 1}`, `{sku: 1}`.

Kept in sync via **direct, synchronous** calls from
`productService.createProduct/updateProduct/archiveProduct`,
`variantService.createVariant/updateVariant/archiveVariant` (variant price/
SKU feed the product's search doc), and `ratingAggregationService`
(rating/reviewCount are ranking signals) — wrapped in `.catch(() => {})` so
an indexing failure never fails the underlying product/variant write. No
event queue is involved (rule #64 calls for one) — same "no queue
infrastructure exists in this project" gap noted for background jobs since
Phase 5. `indexingService.reconcile()` (admin-triggered via `POST
/admin/search/reconcile`) diffs `Product` ids against
`ProductSearchIndex` ids, re-indexing anything missing and removing
anything orphaned, as the honest substitute for a real event-driven
pipeline.

**SearchSynonym** (Phase 13) — admin-configured query expansion: `term`
(unique, lowercase), `synonyms[]`, `status` (`active`/`inactive`),
`createdBy` (ref User). "kaju" → `["cashew", "cashew nuts"]" applied at
query time by `synonymService.expandQuery`, never hard-coded into
application code (rule #13) — editing a synonym takes effect immediately,
no reindex required.

**SearchRule** (Phase 13) — admin-configured merchandising: `query`
(lowercase, matched case-insensitively), `action`
(`pin`/`boost`/`bury`/`redirect`), `product` (ref Product, the pin/boost/
bury target), `redirectUrl`, `priority`, `status` (`active`/`inactive`),
`startAt`/`endAt`, `createdBy`. Index: `{query: 1, status: 1}`. **A real
bug found and fixed here**: pinning a product only reordered whatever the
text search had already matched — if the pinned product didn't organically
match the query, `applyMerchandising` silently dropped the pin. Fixed by
having it fetch any missing pinned product directly from
`ProductSearchIndex` and inject it (see `docs/search.md`). Known accepted
simplification: an injected pin doesn't increment the response's `total`
count.

**SearchEvent** (Phase 13) — append-only behavioral analytics, deliberately
separate from the transactional DB and the search index (rule #133):
`type` (`performed`/`clicked`/`no_results`/`add_to_cart`), `query`/
`normalizedQuery`, `resultCount`, `filters` (Mixed), `sort`, `product` (ref
Product, for `clicked`/`add_to_cart`), `position` (result position
clicked, rule #52/#55), `sessionId`, `customer` (ref User). Stores only
`sessionId`/`customer` for identity — **never** email/phone/payment info
(rule #117), even though `customer` is a ref that could be populated, the
schema itself carries no PII fields to populate from. Indexes:
`{type: 1, createdAt: -1}`, `{normalizedQuery: 1, type: 1}`. Aggregated by
`searchAnalyticsService.js` (top queries, zero-result queries, CTR,
zero-result rate) for `GET /admin/search/analytics` — never recomputed by
scanning every `ProductSearchIndex` document.

**WebhookEvent** (Phase 7) — records every processed payment-provider
webhook by its provider-assigned event id: `provider` (default
`"razorpay"`), `providerEventId`, `type`, `processedAt`. Compound unique
index `{ provider: 1, providerEventId: 1 }` — the actual idempotency guard
for webhook retries; a duplicate delivery of an already-processed event
hits `E11000` on the `create()` call and is treated as already-handled
rather than reprocessed (payment providers routinely retry webhooks that
don't return a fast 2xx).

**Role** (Phase 14) — the granular RBAC role `User.adminRole` points at:
`name` (unique, uppercase), `description`, `permissions[]` (string codes,
e.g. `"products.update"` — full catalog in `utils/rbac.js#PERMISSIONS`),
`isSystem` (boolean). `isSystem: true` on the nine seeded roles
(`SUPER_ADMIN, ADMIN, CATALOG_MANAGER, INVENTORY_MANAGER, ORDER_MANAGER,
CUSTOMER_SUPPORT, MARKETING_MANAGER, FINANCE_MANAGER, ANALYST` — seeded
idempotently at boot by `utils/seedRoles.js`) blocks delete/rename via the
API (`SYSTEM_ROLE_PROTECTED`) — every permission check in the codebase
assumes these nine exist. `SUPER_ADMIN` carries an empty `permissions[]`;
it's a sentinel name checked directly in `utils/rbac.js#hasPermission`, not
a stored list, so a permission added in a future phase is automatically
covered without a migration.

**AdminAuditLog** (Phase 14) — the cross-cutting "what did this admin do"
trail: `actor` (ref User), `action` (string, e.g. `PRODUCT_UPDATED`,
`ROLE_CHANGED`, `CUSTOMER_BLOCKED`), `entityType`/`entityId`, `before`/
`after` (Mixed snapshots), `ip`, `requestId`. Deliberately separate from
the domain-specific event logs that already existed (`OrderEvent`, Phase 9;
`ShipmentEvent`, Phase 10) — those answer "what happened to this
order/shipment"; this answers "what did this admin do," searchable across
every module in one place. Append-only by convention — no update/delete
route exists for this model at all, not merely permission-gated. Written
only via `services/admin/adminAuditService.js#recordAdminAction`, always
`.catch(() => {})`-wrapped at the call site so an audit-logging failure
never fails the underlying admin action. Indexes: `{ createdAt: -1 }`,
`{ actor: 1, createdAt: -1 }`, `{ action: 1, createdAt: -1 }`,
`{ entityType: 1, entityId: 1 }`.

**AdminInvite** (Phase 14) — `email`, `role` (ref Role), one-time `token`
(unique — the credential itself, not a lookup key paired with a password),
`invitedBy` (ref User), `status` (`pending`/`accepted`/`expired`/`revoked`),
`expiresAt` (7 days from creation), `acceptedAt`. Admins are never created
via direct password assignment — `adminUserService.js#acceptInvite` is the
only path that creates an admin `User`, and it requires a valid,
unexpired, still-`pending` token. Index: `{ email: 1, status: 1 }`.

**Page** (Phase 15) — a single unified model for static pages, marketing
landing pages, AND the homepage, distinguished only by `pageType`
(`"static"|"landing"|"homepage"`) — not three near-identical schemas,
which would otherwise triplicate the lifecycle/revision/block machinery.
The homepage is simply the one `Page` with `pageType: "homepage"`, a
singleton by convention (`pageService.getOrCreateHomepage` lazily creates
it) rather than a unique index, since a future multi-store CMS would need
more than one. `title`, `slug` (unique), `blocks[]` (embedded, `{type,
order, data, visibility, settings}` — structured/validated JSON per
`services/cms/blockRegistry.js`, never a raw HTML blob; commerce entities
are referenced by id — `productIds`/`categoryId`/`collectionId` inside
`data` — never duplicated into the document), `seo` (`title`,
`description`, `canonicalUrl`, `ogTitle/ogDescription/ogImage`,
`robots`), `status` (`draft|in_review|approved|scheduled|published|
archived`, same explicit-graph pattern as Phase 9's `Order.status`),
`version`, `author`/`reviewedBy`/`publishedBy` (ref User),
`publishedAt`/`scheduledAt`/`unpublishAt`.

**BlogPost** (Phase 15) — genuinely separate from `Page` (different
fields, different listing/filtering shape) but shares the exact same
lifecycle enum and the same `ContentRevision` model rather than a
duplicate `BlogRevision` collection: `title`, `slug` (unique), `excerpt`,
`content` (Mixed — structured rich-text blocks, sanitized on save, never
raw HTML), `featuredImage` (ref MediaAsset), `category`, `tags[]`, `seo`,
`status`/`version`/`author`/`reviewedBy`/`publishedBy`/`publishedAt`/
`scheduledAt` (identical shape to Page).

**ContentRevision** (Phase 15) — one generic revision model shared by
both `Page` and `BlogPost` (`contentType: "page"|"blog"`), not a separate
`PageRevision`/`BlogRevision` pair — the shape ("a full snapshot of the
content entity, who made it, why") is identical for both. `contentType`,
`contentId`, `version`, `snapshot` (Mixed — the full document at save
time), `author` (ref User), `changeSummary`. Append-only: restoring a
revision creates a **new** revision and returns the content to `draft`;
it never deletes history and never republishes directly.

**FAQ** (Phase 15) — `question`, `answer` (sanitized, same rule as Phase
12's reviews), `category` (free text, not a separate collection),
`order`, `status` (`active|inactive`), `createdBy` (ref User).

**Banner** (Phase 15) — `title`, `image`/`mobileImage` (ref MediaAsset),
`link`, `cta`, `startDate`/`endDate`, `status` (`active|inactive`),
`priority`, `target` (`homepage|category|collection`), `targetId` (ref
Category or Collection, depending on `target`), `impressions`/`clicks`
(server-side `$inc` counters, never trusted from the client). Scheduling
is enforced at **read time** — `bannerService.getActiveBanners` filters
`startDate`/`endDate` against `now()` on every call, same lazy-check
pattern as Cart/Checkout expiry; no background scheduler flips `status`
automatically.

**NavigationMenu** (Phase 15) — a singleton **per name** (`"header"`,
`"footer"`, ...) via upsert, not a growing collection: `name` (unique),
`items[]` (two levels only — top item + `children[]`, deliberately not a
fully recursive tree). Each item is `label`, `type`
(`page|product|category|collection|external|anchor`), `refId` (entity
reference when one exists — preferred over a raw internal URL),
`url` (only meaningful for `external`/`anchor`), `target`, `order`,
`visibility`.

**FooterConfig** (Phase 15) — a singleton document (one row for the whole
store, upserted on first write) rather than a list: `columns[]` (`title`,
`links[]`), `socialLinks[]`, `contactInfo`, `legalLinks[]`,
`newsletterHeading`/`newsletterSubtext`.

**MediaAsset** (Phase 15) — same honest-stub shape as Phase 12's
`ReviewMedia`: real model, real MIME/size validation
(`mediaService.js`), but no actual object-storage/CDN integration exists
— `url`/`storageKey` are supplied by the caller. `filename`, `type`
(`image|video|document`), `url`, `storageKey`, `mimeType`, `size`,
`width`/`height`, `altText` (enforced at publish-validation time, not
upload time), `caption`, `uploadedBy` (ref User), `status`
(`ready|archived`). Referenced media can't be deleted while still in use
(`MEDIA_IN_USE`) — usage tracking scans the same reference set that
orphan detection (`listOrphanedMedia`) scans in reverse.

**Redirect** (Phase 15) — `source` (unique), `destination`, `statusCode`
(`301|302`), `status` (`active|inactive`), `createdBy` (ref User).
`redirectService.createRedirect` walks the existing chain (up to 20 hops)
before accepting a new one — rejects a self-redirect, a direct A↔B loop,
and a duplicate `source`, none of which the schema alone could prevent.

**SEOSettings** (Phase 15) — a singleton: global SEO defaults a page/blog
post falls back to only when its own SEO fields are empty (a
page-specific value always wins — `seoService.js#resolveSEO`).
`defaultTitle`/`defaultDescription`/`defaultOgImage`, `robotsGlobal`
(`index_follow|noindex_follow`), `updatedBy` (ref User). Mutating this
requires `cms.seo.update` specifically, separate from ordinary page-edit
permissions, so a content editor can't accidentally set the whole site to
`noindex` while editing one page.

## Indexes added in this pass

- `Order`: `{ user: 1, createdAt: -1 }` — speeds up `getMyOrders`.
- `Review`: `{ product: 1 }` — speeds up `getReviewsByProduct`.
- `Address`: `{ user: 1 }`, `{ user: 1, isDefaultShipping: 1 }`,
  `{ user: 1, isDefaultBilling: 1 }`.
- `UserPreferences`: unique `{ user: 1 }`.
- `Product`: unique `{ slug: 1 }`, `{ status: 1, visibility: 1 }` (every
  public listing query filters on both), `{ category: 1 }`,
  `{ collections: 1 }`, `{ tags: 1 }`, `{ createdAt: -1 }` (newest sort),
  text index on name/short/long description (unchanged).
- `Category`: `{ parent: 1 }` (tree building), `{ status: 1 }`.
- `Collection`: `{ status: 1 }`.
- `ProductVariant`: unique `{ sku: 1 }`, `{ product: 1, status: 1 }`
  (product detail's "eligible variants" query), `{ product: 1, sortOrder: 1 }`
  (deterministic display order), unique `{ product: 1, combinationKey: 1 }`
  (the duplicate-combination guard).
- `Inventory`: unique `{ variant: 1, location: 1 }`, `{ status: 1 }`.
- `InventoryReservation`: unique `{ referenceType: 1, referenceId: 1, variant: 1 }`
  (idempotency), `{ status: 1, expiresAt: 1 }` (expiry sweep), `{ variant: 1, location: 1 }`.
- `StockMovement`: partial-unique `{ referenceType: 1, referenceId: 1, variant: 1, type: 1 }`,
  `{ variant: 1, location: 1, createdAt: -1 }` (movement history per SKU), `{ createdAt: -1 }`.
- `Cart`: unique partial `{ user: 1, status: 1 }`, unique partial
  `{ guestId: 1, status: 1 }` (one active cart per identity), `{ expiresAt: 1 }`.
- `CartItem`: unique `{ cart: 1, variant: 1 }` (duplicate-line guard),
  `{ cart: 1 }` (fetch-all-lines-for-a-cart).
- `Checkout` (Phase 7): `{ user: 1, status: 1 }`, `{ expiresAt: 1 }`,
  unique partial `{ idempotencyKey: 1 }` (sparse — the place-order retry
  guard).
- `Coupon` (Phase 7): unique `{ code: 1 }`.
- `WebhookEvent` (Phase 7): unique `{ provider: 1, providerEventId: 1 }` —
  the webhook-dedup guard; a duplicate delivery of the same event fails
  this constraint instead of being reprocessed.
- `Payment` (Phase 8): `{ order: 1 }`, `{ user: 1, createdAt: -1 }`, unique
  sparse `{ providerOrderId: 1 }`, unique sparse `{ providerPaymentId: 1 }`
  (single-field, see model note above).
- `PaymentAttempt` (Phase 8): unique `{ order: 1, attemptNumber: 1 }`,
  `{ payment: 1 }`, unique sparse `{ idempotencyKey: 1 }`.
- `Refund` (Phase 8): `{ payment: 1 }`, unique sparse
  `{ providerRefundId: 1 }` (single-field, same reasoning as `Payment`).
- `Order` (Phase 9, additional): unique `{ orderNumber: 1 }`, unique
  sparse `{ idempotencyKey: 1 }`, `{ status: 1, createdAt: -1 }`,
  `{ paymentStatus: 1 }`, `{ fulfillmentStatus: 1 }`.
- `OrderEvent` (Phase 9): `{ order: 1, createdAt: 1 }` (timeline read
  order).
- `Warehouse` (Phase 10): unique `{ code: 1 }`.
- `Fulfillment` (Phase 10): `{ order: 1, status: 1 }`,
  `{ warehouse: 1, status: 1 }`.
- `FulfillmentItem` (Phase 10): `{ fulfillment: 1 }`.
- `Shipment` (Phase 10): `{ order: 1 }`, `{ fulfillment: 1 }`,
  `{ status: 1 }`, unique sparse `{ trackingNumber: 1 }`, unique sparse
  `{ carrierShipmentId: 1 }` (single-field, not compound with `carrier` —
  see model note above), unique sparse `{ idempotencyKey: 1 }`.
- `ShipmentItem` (Phase 10): `{ shipment: 1 }`.
- `ShipmentEvent` (Phase 10): `{ shipment: 1, eventTime: 1 }`.
- `Order` (Phase 11, additional): `items[].discountAmount` (no new index —
  read as part of the existing document, never queried independently).
- `Coupon` (Phase 11, rewritten): unique `{ code: 1 }` (unchanged), plus
  `{ promotion: 1 }`, `{ status: 1 }`.
- `Promotion` (Phase 11): `{ status: 1, startAt: 1, endAt: 1 }` (the
  automatic-promotion candidate query — indexed, not "load every
  promotion and filter in JS"), `{ priority: -1 }`,
  `{ requiresCoupon: 1, status: 1 }`.
- `CouponRedemption` (Phase 11): `{ coupon: 1 }`, `{ customer: 1 }`,
  `{ order: 1 }`.
- `CouponCustomerUsage` (Phase 11): unique `{ coupon: 1, customer: 1 }` —
  the actual atomic per-customer-limit concurrency guard.
- `Product` (Phase 12, additional): `ratingSum`, `ratingDistribution`,
  `verifiedReviewCount`, `photoReviewCount` (no new index — read as part of
  the existing document, never queried independently).
- `Review` (Phase 12, rewritten): unique `{ product: 1, user: 1 }`,
  `{ product: 1, status: 1, createdAt: -1 }`, `{ user: 1, createdAt: -1 }`,
  `{ status: 1, createdAt: -1 }`.
- `ReviewVote` (Phase 12): unique `{ review: 1, user: 1 }`.
- `ReviewReport` (Phase 12): unique `{ review: 1, user: 1 }`, `{ review: 1 }`,
  `{ status: 1, createdAt: -1 }`.
- `ReviewMedia` (Phase 12): `{ review: 1 }`.
- `ProductSearchIndex` (Phase 13): unique `{ product: 1 }`, weighted text
  index on `name`/`shortDescription`/`description`/`tags`/`keywords`/
  `category` (see model note above), `{ categoryId: 1 }`, `{ price: 1 }`,
  `{ rating: -1 }`, `{ isActive: 1, isPublished: 1 }`, `{ sku: 1 }`.
- `SearchSynonym` (Phase 13): unique `{ term: 1 }`.
- `SearchRule` (Phase 13): `{ query: 1, status: 1 }`.
- `SearchEvent` (Phase 13): `{ type: 1, createdAt: -1 }`,
  `{ normalizedQuery: 1, type: 1 }`.
- `Role` (Phase 14): unique `{ name: 1 }`.
- `AdminAuditLog` (Phase 14): `{ createdAt: -1 }`, `{ actor: 1, createdAt: -1 }`,
  `{ action: 1, createdAt: -1 }`, `{ entityType: 1, entityId: 1 }`.
- `AdminInvite` (Phase 14): unique `{ token: 1 }`, `{ email: 1, status: 1 }`.
- `User` (Phase 14, additional): `adminRole`, `blockedAt`, `blockedBy`,
  `blockReason` (no new index — read as part of the existing document,
  never queried independently).
- `Page` (Phase 15): `{ status: 1, pageType: 1 }`, `{ scheduledAt: 1 }`,
  `{ unpublishAt: 1 }`, unique `{ slug: 1 }`.
- `BlogPost` (Phase 15): unique `{ slug: 1 }`, `{ status: 1, publishedAt: -1 }`,
  `{ category: 1, status: 1 }`, `{ tags: 1 }`, `{ scheduledAt: 1 }`.
- `ContentRevision` (Phase 15): `{ contentType: 1, contentId: 1, version: -1 }`.
- `FAQ` (Phase 15): `{ category: 1, order: 1 }`, `{ status: 1 }`.
- `Banner` (Phase 15): `{ status: 1, startDate: 1, endDate: 1 }`,
  `{ target: 1, targetId: 1 }`.
- `NavigationMenu` (Phase 15): unique `{ name: 1 }`.
- `MediaAsset` (Phase 15): `{ type: 1, status: 1 }`, `{ createdAt: -1 }`.
- `Redirect` (Phase 15): unique `{ source: 1 }`.

## Migration note (Phase 12)

`Review` was rewritten, not extended — the pre-Phase-0 flat
`{product, user, rating, comment, helpfulCount, helpfulBy[]}` shape is gone,
replaced by the fuller model above. The new `unique {product, user}` index
is the one that actually needs a real migration against existing data: any
product that already had more than one review from the same customer would
violate the constraint immediately on index build. A production cutover
would need to pick a survivor per `{product, user}` pair (e.g. keep the
most recent, soft-delete the rest) before the index could be created, plus
backfill `status: "published"` (so pre-existing reviews keep counting
toward the aggregate) and recompute `Product.ratingSum`/`ratingDistribution`/
`verifiedReviewCount`/`photoReviewCount` from the survivors via
`ratingAggregationService`, since those fields didn't exist before. Applied
as a direct cutover here, same reasoning as every other pre-launch schema
change in this project: no production review data exists yet.

## Migration note (Phase 11)

`Coupon` was rewritten, not extended — Phase 7's `type`/`value`/
`minSubtotal`/`maxDiscount`/`usedCount`/`expiresAt` fields are gone,
replaced by a required `promotion` ref plus optional override fields. Any
existing `Coupon` document from Phase 7 would fail to validate against the
new schema (no `promotion` field) and would need a real migration: create a
matching `Promotion` document per existing coupon (mapping `type: "percent"
→ PERCENTAGE`, `type: "fixed" → FIXED_AMOUNT`, `value/minSubtotal/
maxDiscount` straight across into `actions`/`conditions`), then update the
`Coupon` row to point at it and drop the old fields. Applied as a direct
cutover here, same reasoning as every other pre-launch schema change in
this project: no production coupon data exists yet.

## Migration note (Phase 9)

`Order.status` was renamed from a seven-value enum to a twelve-value one
(see the breaking-change callout under **Order** above) — not additive,
values were removed and replaced. Applied as a direct schema cutover, same
reasoning as the Phase 4/Phase 6 cutovers below: no production order data
exists yet. Against real data this would need: backfill every existing
`Order.status` to its new equivalent (`pending→pending_payment`,
`paid→confirmed` + `paymentStatus:"succeeded"`, `processing→processing`,
`shipped→shipped`, `delivered→delivered`, `cancelled→cancelled`), derive
`paymentStatus`/`fulfillmentStatus` from the old single field, then only
after backfill switch the schema enum over — never a bare
`enum: [...]` swap against a live collection.

## Migration note (Phase 6)

`User.cart[]` (the embedded array every phase up to this one used) was cut
over directly to the `Cart`/`CartItem` collections, same reasoning as
Phase 4's variant cutover — no production data exists yet. A production
cutover would need the same dual-write → backfill → verify → remove
sequence noted below for variants.

## Migration note (Phase 4)

`Product.variants[]` (the embedded array from Phase 3) was cut over
directly to the `ProductVariant` collection rather than run through a
parallel-write migration window — safe because no production data exists
yet (confirmed in Phase 0's audit; this is still pre-launch). A production
cutover would instead need: dual-write both shapes → backfill
`ProductVariant` from existing embedded data → verify counts/prices match →
stop writing the embedded shape → remove it. Do that properly if this ever
runs against real customer data.

## Notifications (Phase 16)

- **`NotificationEvent`** — the outbox. `eventId` unique (idempotency key),
  `status: pending|processed|failed`. Every business event is persisted
  here before the in-process event bus fans it out, so a crash mid-
  processing leaves a recoverable row rather than silently losing the
  event.
- **`Notification`** — one logical notification (channel-agnostic — what
  the Notification Center reads). `dedupeKey` (unique sparse) prevents a
  duplicate event from creating a second notification for the same
  recipient.
- **`NotificationDelivery`** — one row per channel per Notification.
  Deliberately folds what the spec calls a separate
  "NotificationProviderLog" into this single model (provider,
  providerMessageId, errorClass, attempt, timestamps) rather than a
  parallel table — same simplification reasoning as Phase 15 collapsing
  page/blog revision history into one `ContentRevision` model.
- **`NotificationPreference`** — one doc per user, upserted only once a
  user deviates from the code-level defaults (`preferenceService.js`'s
  `DEFAULTS`) — a fresh user needs no backfilled row.
- **`NotificationTemplate`** / **`NotificationTemplateRevision`** — draft/
  published + append-only revision snapshots. Unique on
  `(type, channel, locale)`. Restoring a revision creates a **new**
  revision (never rewrites history) — identical semantics to
  `Page`/`BlogPost` + `ContentRevision` in Phase 15.
- **`NotificationCampaign`** — marketing campaigns. `audience` is a query
  descriptor (`{segment, filter}`), resolved to real recipients only at
  send time — never a stored, staling recipient list.
- **`NotificationDevice`** — push token registry, unique on
  `(user, deviceId)`. Tokens are never returned unmasked by any service
  function.
- **`NotificationSuppression`** — unique on `(channel, value)`. Checked by
  every channel before a send; never deleted automatically, only by
  explicit admin action.

## Analytics (Phase 17)

- **`AnalyticsEvent`** — raw client-instrumented behavioral events
  (`PAGE_VIEW`, `PRODUCT_VIEW`, `ADD_TO_CART`, ...). `eventId` unique
  (idempotency). **`AnalyticsEventDLQ`** — malformed events, never
  silently dropped.
- **Daily aggregates** (`DailySalesMetric`, `ProductDailyMetric`,
  `CategoryDailyMetric`, `CustomerDailyMetric`, `PaymentDailyMetric`,
  `ShippingDailyMetric`, `DiscountDailyMetric`, `FunnelDailyMetric`) — one
  row per business day (store-timezone bucketed), updated incrementally
  via `$inc` upserts by `analyticsWorker.js`, never recomputed wholesale
  except through the explicit `rebuildService.js` path. Only day-grain is
  materialized; week/month/year sum daily rows at query time.
- **`VisitorDaily`** — one row per (day, visitor) upserted on first
  behavioral event of the day; backs `FunnelDailyMetric.visitors` as an
  exact distinct count (a running counter alone can't tell new-today from
  already-counted).
- **`AnalyticsExportJob`** — async-shaped export lifecycle
  (pending/processing/completed/failed), CSV content kept inline (no
  object storage exists in this project — same honest-stub gap as CMS
  media), gated by a short-lived unguessable `downloadToken`.
- **`AnalyticsReport`** — on-demand/scheduled-intent reports; delivery
  reuses Phase 16's notification pipeline (`REPORT_READY` event) rather
  than a second delivery mechanism.

## Future scalability notes (not implemented yet)

- `User.cart`/`User.wishlist` are embedded arrays of product refs. Fine at
  current scale; if cart/wishlist need independent querying or heavy write
  volume, consider promoting them to their own collections.
- Inventory (stock counts) is intentionally not part of `ProductVariant`
  yet — catalog/variant answers "what is purchasable", inventory answers
  "how many are available"; a dedicated `Inventory` collection keyed by
  variant `_id`/`sku` can be added without touching this schema.
- Pricing is still a flat `price`/`mrp` on the variant — no bulk pricing,
  customer-specific pricing, or promotions yet; those belong to a Pricing
  service that reads from (not replaces) `ProductVariant.price`.
- Products are no longer hard-deleted (`archiveProduct` sets
  `status: "archived"`), and neither are variants (`archiveVariant`, same
  pattern) — but Category/Collection deletion is still a real delete, safe
  today because `deleteCategory`/`deleteCollection` refuse to run while any
  product/child still references them.
