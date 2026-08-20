# Shipping & Fulfillment (Phase 10)

## The core rule

`Order → Fulfillment → Shipment → Carrier` — never `Order → tracking
number`. Tracking numbers, labels, and carrier state all live on
`Shipment`, never on `Order` itself, because one order can produce more
than one shipment (multi-warehouse, partial fulfillment, re-shipped
replacements) and `Order` having a single `trackingNumber` field would make
that architecturally impossible later.

## Fulfillment vs Shipment

**Fulfillment** answers "what items are being prepared, from which
warehouse?" **Shipment** answers "which physical package went out, through
which carrier, with what tracking number?" A single order can have one
`Fulfillment` produce one `Shipment` (the default, simple case this phase
actually exercises end-to-end) or, architecturally, multiple fulfillments
(different warehouses) each producing their own shipment(s) — nothing in
the schema prevents that, even though no UI currently drives an admin
through splitting one order across two fulfillments interactively.

## Models

- **`Warehouse`** — minimal (`name`, `code`, `address`, `status`); exists as
  a real referenced model (not a free-text string) so multi-warehouse
  fulfillment can slot in later without a schema change.
- **`Fulfillment`** — `order`, `warehouse`, `status` (see state machine
  below).
- **`FulfillmentItem`** — links a Fulfillment back to specific order lines.
  Since `Order.items` are embedded subdocuments without their own `_id`
  (Phase 7/9), the link is by `variant` within the order rather than a
  subdocument foreign key — sufficient because an order never has the same
  variant on two separate lines.
- **`Shipment`** — `order`, `fulfillment`, `warehouse`, `carrier`,
  `carrierShipmentId`, `trackingNumber`, `trackingUrl`, `status`,
  `shippingMethod`, `customerShippingCharge` (what the customer paid, from
  `Order.shippingCost`) vs `carrierShippingCost` (what the carrier actually
  charges — never shown to the customer, rule #52), `labelUrl`,
  `estimatedDeliveryFrom/To`, `shippedAt`, `deliveredAt`, `failureReason`,
  `idempotencyKey`.
- **`ShipmentItem`** — links a Shipment to `FulfillmentItem`s with its own
  `quantity`, because one order line (e.g. "Product A × 3") can legitimately
  split across two shipments ("A × 1" in one, "A × 2" in another) — the
  shipped quantity has to be tracked independently of both the order line
  and the fulfillment line.
- **`ShipmentEvent`** — append-only tracking history. `eventTime` (when the
  carrier says it happened) is kept separate from `createdAt` (when this
  system recorded it), since carrier events can arrive late.

## A real bug found and fixed: forward-skip vs backward-stale

Carrier webhook events can arrive out of order or be duplicated, and rule
#90 says "don't move status backwards" — but the first implementation
conflated that with "every intermediate stage must be present," using the
full step-by-step `shipmentStateMachine` graph to gate *every* incoming
webhook event. That's wrong: real carriers frequently skip micro-statuses
(going straight from `label_created` to `in_transit` without ever emitting
`ready_for_pickup`/`picked_up`), and the strict graph silently dropped
those legitimate forward-progress events, leaving the shipment stuck.
Verified via test: a webhook claiming `IN_TRANSIT` right after
`label_created` was recorded as a `ShipmentEvent` but never applied to
`Shipment.status`, which stayed on `label_created` indefinitely.

Fixed by splitting the two concerns `shipmentService.js#applyShipmentStatus`
now actually needs:
- **Backward movement** (a stale/late/duplicate event claiming an earlier
  stage than the shipment is already at) — blocked by
  `isStaleForwardEvent`, comparing rank on the normal forward-progress line.
- **Forward movement, however far it skips** — always applied, once it's
  confirmed not to be backward. The strict `TRANSITIONS` graph
  (`shipmentStateMachine.js`) is still enforced only for the *branch*
  transitions off that line (into `delivery_failed`, `rto_*`, `cancelled`),
  where skipping genuinely isn't legitimate (you can't go from `created`
  straight to `rto_delivered`).

Reverified after the fix: the same skip-ahead webhook correctly moved the
shipment to `in_transit`; a subsequent stale, older-timestamped event
claiming `in_transit` after the shipment had already reached
`out_for_delivery` was correctly ignored (recorded as history, not applied).

## State machines

- **Fulfillment**: `pending → allocated → picking → packing →
  ready_to_ship → shipped → completed`, with `cancelled` reachable from any
  pre-shipped state. `shipped`/`completed` are only ever set internally by
  `shipmentService` (creating a shipment / that shipment being delivered),
  never a direct admin action.
- **Shipment**: `created → label_created → ready_for_pickup → picked_up →
  in_transit → { out_for_delivery, delivered, delivery_failed }`, with
  `delivery_failed → { out_for_delivery, rto_initiated } → rto_in_transit →
  rto_delivered`, and `cancelled` reachable before pickup. `label_failed` is
  a recoverable side-state (`generateLabel` can be retried from there).

## Carrier abstraction

`services/carriers/` — `carrierFactory.js` resolves `SHIPPING_CARRIER` (env,
default `mock`) to one adapter (six methods: `getRates`,
`getEstimatedDelivery`, `createShipment`, `generateLabel`,
`cancelShipment`, `trackShipment`, plus the webhook trio
`hasWebhookSecret`/`verifyWebhookSignature`/`parseWebhookEvent`).
`mockCarrierAdapter.js` is a **fully working simulation** — the inverse of
Phase 8's Stripe stub: there, the stub was the non-working placeholder and
the real provider (Razorpay) did the work; here, `mock` is the one with
real logic and `shiprocketAdapter.js` is the honest stub (no Shiprocket
account exists in this project, every method throws
`CARRIER_NOT_CONFIGURED` rather than faking success). Swapping `mock` for a
real Shiprocket/Delhivery implementation later means writing one new
adapter file to the same six-method contract — nothing in `shipmentService`
or any other domain needs to change.

## Status normalization

`services/carriers/statusMapper.js` — every adapter's `parseWebhookEvent`
runs its own carrier's raw status string through a matching map before
handing a normalized value (matching `Shipment.status`'s enum) back to
`shipmentService`. `MOCK_STATUS_MAP` and the illustrative
`SHIPROCKET_STATUS_MAP` both resolve to the exact same internal vocabulary
— nothing downstream ever sees "Dispatched" vs "Picked Up," only
`picked_up`.

## Webhook

`POST /shipping/webhooks/:carrier` — no auth, HMAC-verified over the raw
body (same `req.rawBody` capture as Phase 8's payment webhook), fails
closed if no secret configured. Deduplicated via the same `WebhookEvent`
model Phase 8 introduced (`provider` = carrier name here), so a retried
carrier delivery is a no-op. Verified: invalid signature rejected (400);
duplicate event returned `{ok:true, duplicate:true}` without reprocessing.

## Order/Fulfillment synchronization

`services/orderFulfillmentSync.js#syncOrderFulfillmentState` recomputes
`Order.fulfillmentStatus` from **every** shipment across **every**
fulfillment belonging to the order — never set directly from one
shipment's webhook in isolation (rule #87). `Order.fulfillmentStatus`
gained two Phase-10 values, `partially_shipped`/`partially_delivered`
(additive to Phase 9's enum, not a rename — no migration needed for this
one), reached when an order's shipments aren't all at the same stage.
`Order.status` itself only moves to `delivered` once every shipment is
unambiguously delivered — partial states are expressed only in the
finer-grained `fulfillmentStatus`. This write deliberately bypasses
`orderStateMachine`'s narrower admin-facing transition graph, the same
documented pattern as Phase 9's refund-driven `order.status = "refunded"`
assignment — a shipment-delivered fact is a SYSTEM event arriving
asynchronously, not a single-step admin action. Verified end-to-end: a
single-shipment order's delivery webhook cascaded correctly —
`Shipment.status: delivered` → `Fulfillment.status: completed` →
`Order.fulfillmentStatus: delivered` → `Order.status: delivered`.

## Idempotency

- **Shipment creation** (`Shipment.idempotencyKey`, unique sparse) — a
  repeated admin "Create Shipment" click with the same key returns the
  existing shipment rather than opening a second carrier shipment. Verified.
- **Label generation** — `generateLabel` checks for an existing `labelUrl`
  first and no-ops if one's already there, rather than re-calling the
  carrier. Verified: two calls returned the identical label URL.
- **Webhook processing** — see above.

## Inventory integration

Deliberately does **not** call `inventoryService` again at fulfillment
creation or allocation. By the time an order reaches Fulfillment, its stock
was already reserved (Phase 5, at order creation) and committed (Phase 8,
on payment success) — "allocation" here means assigning already-committed
stock to a specific fulfillment record for tracking, not a second
deduction. Calling inventory again here would double-count.

## Customer APIs

`GET /orders/:orderId/shipments` (ownership-checked via the order),
`GET /shipments/:id`, `GET /shipments/:id/tracking` — all return
`utils/shipmentDTO.js`'s safe shape, excluding `carrierShipmentId` (internal
carrier reference), `carrierShippingCost` (never reveal what the carrier
actually charges), `idempotencyKey`, and raw webhook metadata.

## Admin APIs

`/admin/warehouses` (minimal CRUD), `/admin/fulfillments` (create, list,
allocate/pick/pack/ready-to-ship), `/admin/shipments` (create shipment,
generate label, cancel, poll, list) — all behind `adminOnly`. No
SUPPORT/WAREHOUSE intermediate role exists in this project's RBAC (same
honest limitation noted since Phase 9); these sit behind the existing
customer/admin split.

## IDOR

Every customer-facing shipment lookup checks `order.user === req.user._id`
(with an admin-role escape hatch), scoped through the shipment's own
`order` reference — never trusting a shipment id alone. Verified: a
different authenticated user's request for another customer's shipment
returned 403.

## What's explicitly NOT here yet (by design, not oversight)

- **A real carrier account** (Shiprocket/Delhivery/etc.) — `mock` is a
  fully working simulation; `shiprocketAdapter.js` is a structural stub.
- **Tracking-sync background job** — `shipmentService.pollShipmentStatus`
  exists and uses the exact same `applyShipmentStatus` path a webhook would,
  but nothing schedules it automatically; no job scheduler exists in this
  project (same limitation noted since Phase 5).
- **Package/multi-package-per-shipment model** — the spec allows deferring
  this if current requirements are simple; `Shipment` doesn't yet have a
  child `Package` collection, but nothing here assumes exactly one physical
  box per shipment in a way that would block adding one later.
- **Admin fulfillment/shipment dashboard UI** — APIs exist and are
  paginated; no admin frontend was built this phase (matches the project's
  consistent "admin UI is a later module" pattern from Phases 8/9).
- **Returns/RTO customer flow, shipping analytics, circuit breakers,
  scheduled retry/backoff for carrier API calls** — the state enums and
  adapter shape support these (`rto_initiated`/`rto_in_transit`/
  `rto_delivered` exist; `carrierShippingCost` vs `customerShippingCharge`
  are already separate fields for a future profitability report), but no
  code implements them yet.
