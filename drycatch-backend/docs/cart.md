# Cart (Phase 6)

## The core rule

A cart line identifies a **variant**, never just a product — "500g" and
"1kg" of the same product are different purchasable items and must be
separate lines. `CartItem.variant` is required; there is no way to add a
bare product to a cart.

## Guest and authenticated carts, one identity system

Cart works for both. `middleware/cartIdentity.js` resolves every request to
exactly one of `{userId}` (a valid session) or `{guestId}` (a random UUID
in an httpOnly cookie, issued on first visit) — never both. `Cart` has a
DB-unique partial index on each (`{user,status:"active"}` and
`{guestId,status:"active"}`), so a concurrent request can never create two
active carts for the same identity.

## Guest → user merge

On login/signup-verify, `mergeGuestCartIntoUser(guestId, userId)` runs:
guest cart items are added into the user's cart (summed if the same
variant exists in both), capped at whatever inventory is actually
available rather than producing an unpurchasable line, then the guest cart
is marked `converted`. It's idempotent by construction — once converted, a
retried merge call finds no `active` guest cart and no-ops.

## Concurrency

Every mutation is a single atomic operation, never a `find()` then a
separate `update()`:

- **Add** (`POST /cart/items`, ADD semantics): `CartItem.findOneAndUpdate`
  with `$inc: {quantity}` and `upsert: true`. Verified: 100 concurrent "+1"
  requests against one line produced exactly one `CartItem` document with
  `quantity: 100` — no lost updates, no duplicate lines. A create-race
  (two concurrent adds both attempting the initial upsert) is caught via
  the unique `{cart, variant}` index and retried as a plain increment.
- **Update** (`PATCH /cart/items/:itemId`, SET semantics): a plain
  `$set`. Concurrent SETs are inherently last-write-wins (that's what SET
  means), but verified to never produce a duplicate or corrupted line —
  10 concurrent SET requests left exactly one line with a valid quantity.

## Money

All summary math (`services/cartService.js#getCartSummary`) happens in
integer paise (`utils/money.js`) and is only converted back to a decimal
rupee amount at the very end — floats are never summed as a source of
financial truth.

## Backend authority

The client sends `{variantId, quantity}` and nothing else. Every other
field in the cart response — product name, image, current unit price,
per-line subtotal, availability — is generated server-side from live
catalog/inventory data on every `GET /cart`. A submitted `price`/`total`/
`productName` is simply ignored (there's no field for it to land in).

## Availability, revalidated on every read

Each line reports one of `IN_STOCK` / `LOW_STOCK` / `INSUFFICIENT_STOCK` /
`OUT_OF_STOCK` / `PRODUCT_UNAVAILABLE` / `VARIANT_UNAVAILABLE`, computed
fresh against current inventory (Phase 5) and catalog status — never
cached, never assumed still true from when the item was added. Checkout
still re-validates everything again independently (see
`orderController.createOrder`'s reservation flow) — the cart's view is for
display, not the final authority.

## What's explicitly NOT here yet (by design, not oversight)

- **Cart-level coupon/tax/shipping fields** — `summary.discount`/`tax` are
  hardcoded `0`, `shipping` is `null`. These are real integration points
  for future Pricing/Tax/Shipping services, not implemented here to avoid
  faking numbers the business hasn't defined yet.
- **A dedicated `POST /cart/merge` endpoint** — merge only runs
  server-side as part of login/signup, since that's the only point it's
  currently needed; nothing prevents adding an explicit endpoint later if a
  UI needs to trigger it independently.
- **Cart expiration sweeping** — `Cart.expiresAt` is set for guest carts
  but nothing actively deletes expired ones yet (same "no job scheduler
  exists in this project" limitation as Phase 5's reservation expiry —
  see `docs/inventory.md`).
- **Full multi-variant selection directly from listing cards** — product
  cards (Shop/Category/Home) add-to-cart using the product's *default*
  variant (resolved in one batched query per listing page — see
  `productService.js`'s `defaultVariantId`), not a full variant picker.
  Choosing a specific non-default variant requires the product detail page.
