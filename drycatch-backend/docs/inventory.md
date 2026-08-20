# Inventory (Phase 5)

## The core rule

Inventory belongs to the **variant**, never the product. A product like
"Premium Dried Anchovies" doesn't have stock — its 100g/250g/500g variants
each do, independently, keyed by `{variant, location}`.

## Terminology

- **On hand** — physical stock currently held (`Inventory.quantityOnHand`).
- **Reserved** — temporarily committed to an in-progress checkout, not yet
  a final sale (`Inventory.quantityReserved`).
- **Available** — `onHand - reserved`, computed as a virtual, never stored
  (storing a derived number invites drift the moment the two inputs change
  without it).

## The flow

```
Add to cart          → no stock effect at all (see below)
Checkout starts        → reserveStock()   (active reservation, TTL 15 min)
Payment succeeds      → commitReservationsForReference()  (onHand -= qty, reserved -= qty)
Payment fails/timeout  → releaseReservationsForReference() (reserved -= qty)
Reservation expires   → releaseExpiredReservations() lazily releases it the same way
```

Add-to-cart deliberately does **not** reserve stock — it only validates
that the requested quantity doesn't exceed current availability
(`cartController.addToCart`). Reserving on add-to-cart would let an
abandoned cart lock stock away from every other customer indefinitely.

## Concurrency — the one that matters

Every stock mutation is a single **conditional atomic** `findOneAndUpdate`:

```js
Inventory.findOneAndUpdate(
  { variant, location, $expr: { $gte: [{ $subtract: ["$quantityOnHand", "$quantityReserved"] }, quantity] } },
  { $inc: { quantityReserved: quantity } },
  { new: true }
)
```

MongoDB serializes writes to a single document, so this is genuinely
atomic — there is no `find()` then separate `update()` anywhere in this
service. Verified directly: 100 concurrent reservation requests against a
variant with exactly 1 unit of stock produced exactly 1 success and 99
"Insufficient stock" rejections, with `quantityReserved` never exceeding
`quantityOnHand`.

Manual stock adjustments use the same pattern (a negative `delta` is
condition-guarded so on-hand can never go negative), and reservation
release/commit use the same trick on the *reservation's own* status field
(`{_id, status: "active"}` → `{status: "released"}`) so a duplicated
release/commit call is a safe no-op, not a double-deduction.

## Idempotency

A reservation's identity is `{referenceType, referenceId, variant}` — a
DB-unique index, not just an app-level check. A duplicated checkout
request (double-click, retried webhook) for the same order either returns
the existing reservation or, in the rare create-race case, loses the race
gracefully and gives back the stock it briefly held. Verified: 20
concurrent requests sharing one reference produced exactly one reservation
row.

## What's explicitly NOT here yet

- **No background job/cron scheduler** — expired-reservation cleanup is
  lazy (invoked at the start of `reserveStock`, capped and cheap), not a
  timer. A real deployment would want a scheduled sweep too; this project
  has no job infrastructure to hang one on yet (see Phase 0's audit — no
  queue/cron exists). `releaseExpiredReservations()` is exported and safe to
  call from an external cron if one is added later.
- **No multi-location allocation logic** — `MAIN` is the only location;
  the `{variant, location}` key means adding a second warehouse is a new
  `InventoryLocation` document, not a schema change, but nothing picks a
  location automatically yet.
- **No backorders** — available can't go negative, full stop.
- **Admin inventory search** (`listInventory`) filters by SKU/product name
  in application memory after populating — fine at admin-console scale,
  not meant for a catalog with tens of thousands of SKUs.
- **No admin inventory dashboard/table UI** — the API exists
  (`/api/v1/admin/inventory`), the frontend consumes only the public
  availability endpoint so far. Building the actual admin screens is
  deferred to the Admin phase.
