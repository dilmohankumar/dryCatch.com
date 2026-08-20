# Payments (Phase 8)

## The core rule

Payment is a distributed transaction, not a button. The frontend is never
the final authority on success — `services/paymentService.js` is, and it
only marks a payment `succeeded` after independently verifying signature,
amount, and currency against a server-owned `Payment` record. Both the
client-side confirm (`verifyClientPayment`) and the provider's webhook
(`handleWebhookEvent`) funnel through the exact same `markSucceeded`
transition, so it doesn't matter which one arrives first — see Phase 7's
Checkout for the sibling principle applied to pricing.

## Before this phase

Razorpay was called directly from `orderService.js`, and the only payment
"record" was three fields bolted onto `Order` (`razorpayOrderId`,
`razorpayPaymentId`, `razorpaySignature`). No history of failed/retried
attempts, no refund path, no provider abstraction, and no amount/currency
re-check on the webhook — it trusted the payload's own `entity.amount`
implicitly by never comparing it to anything.

## Provider abstraction

`services/payments/` — `providerFactory.js` resolves `PAYMENT_PROVIDER` env
var (default `razorpay`) to one adapter. `razorpayProvider.js` is the only
place `razorpay_order_id` / `razorpay_payment_id` / `razorpay_signature` /
the Razorpay webhook payload shape are allowed to appear — `paymentService`
only ever calls the six adapter methods (`createOrder`,
`verifyPaymentSignature`, `hasWebhookSecret`, `verifyWebhookSignature`,
`parseWebhookEvent`, `fetchPayment`, `refund`), never anything
Razorpay-specific directly. `stripeProvider.js` is a structural stub — same
adapter shape, every method throws `PROVIDER_NOT_CONFIGURED` rather than
faking success, since no Stripe account exists in this project (the same
"honest gap, not a fake implementation" rule Phase 7's `taxService` follows
for its zero tax rate).

## Models

- **`Payment`** — the current payment state for one order. `amount`/
  `currency` in minor units (paise), server-computed from
  `Order.totalAmount` at creation — never client input. Status:
  `created → pending → succeeded | failed | cancelled | expired`, plus
  `refunded` / `partially_refunded` reached only from `succeeded`.
- **`PaymentAttempt`** — one row per distinct attempt (`attemptNumber`).
  Retrying a failed payment creates attempt #2 without touching attempt #1
  — support/reconciliation needs "attempt 1 failed, attempt 2 succeeded" as
  history, not a single field silently overwritten.
- **`Refund`** — one row per refund operation, `amount` bounded by
  `payment.amount - payment.refundedAmount` at creation time.
- **`WebhookEvent`** (from Phase 7, reused unchanged) — the idempotency
  guard for webhook retries, keyed on `{provider, providerEventId}`.

## Order vs Payment state

Kept as two separate state machines, never one field doing both jobs:
`Order.status` (`pending → paid → processing → shipped → delivered`, or
`cancelled`) describes fulfillment; `Payment.status` describes the money.
`markSucceeded`/`markFailed` in `paymentService.js` update both, but they
never collapse into a single shared enum.

## Payment creation

`paymentService.createPaymentForOrder(order, {idempotencyKey})` — called
from `orderService.createOrderFromItems` (both the legacy `/orders` and
Checkout's place-order path already funnel through this one function, per
Phase 7). Amount is always `Math.round(order.totalAmount * 100)` — read
from the order the backend already computed, never from the request.

## Idempotency

Two layers, doing different jobs:

- **Checkout's atomic claim** (Phase 7) — prevents the same checkout from
  being submitted twice, protecting the *order* from being created twice.
- **`PaymentAttempt.idempotencyKey`** (this phase) — prevents the same
  logical payment-creation request from opening a second provider order,
  scoped as `` `${idempotencyKey}:${order._id}` `` rather than the raw
  client key. Reason: a client may legitimately resend the same
  `Idempotency-Key` across retries of one checkout attempt, but each
  successful claim always produces a *new* `Order` — without the order-id
  namespace, a stale key from an earlier attempt that failed and rolled
  back could incorrectly get "reused" against a later, unrelated order.
  Refund idempotency (`Refund.idempotencyKey`) works the same way, unscoped
  since a refund always targets one already-fixed payment.

## Real bug found and fixed this phase

`Payment` and `Refund` originally used **compound sparse unique indexes**
(`{provider, providerOrderId}`, `{provider, providerPaymentId}`,
`{provider, providerRefundId}`). This is a genuine MongoDB gotcha: a sparse
*compound* index only excludes a document from the index when **all**
listed fields are missing — since `provider` is always present, two
`Payment` documents both missing `providerPaymentId` (the normal state
right after creation, before a payment succeeds) were both indexed as
`{provider: "razorpay", providerPaymentId: null}` and collided on the
second insert (`E11000`), verified via a real second-payment creation in
testing. Fixed by indexing `providerOrderId`/`providerPaymentId`/
`providerRefundId` as **single-field** sparse unique indexes instead — a
single-field sparse index correctly excludes any document missing that one
field, regardless of what else is set.

## Webhook

`POST /payments/webhook/:provider` (Phase 7's route generalized from a
Razorpay-only path). No auth — trust comes entirely from
`provider.verifyWebhookSignature(rawBody, signature)`, checked against the
*raw* bytes (`app.js`'s `express.json` `verify` hook), and fails closed
(503) if `hasWebhookSecret()` is false. Deduplicated via `WebhookEvent`'s
unique `{provider, providerEventId}` index exactly as in Phase 7 — a
retried delivery hits `E11000` and is treated as already-handled.

## Amount / currency mismatch protection

`markSucceeded` compares the webhook/verify payload's amount and currency
against **our own** `Payment.amount`/`Payment.currency` — not against
whatever the provider claims the order should be. A mismatch throws
`PAYMENT_AMOUNT_MISMATCH`/`PAYMENT_CURRENCY_MISMATCH` (logged via
`logAuditEvent`, never silently marked paid) and the payment stays
`pending`, not `succeeded` — verified: a webhook claiming double the real
amount was rejected and the payment's status was untouched.

## Retry

`POST /orders/:id/retry-payment` → `paymentService.retryPayment`. Only
allowed when the order isn't `shipped`/`delivered`/`cancelled` and the
payment isn't already `succeeded`/`refunded`/`partially_refunded`. Creates
a new `PaymentAttempt` (attemptNumber incremented) and a fresh provider
order; the old attempt's row is untouched. Verified: two attempts on the
same order left `attemptNumber: [1, 2]` in `PaymentAttempt`, not one row
overwritten.

## Refunds

`POST /payments/:paymentId/refund` (admin-only — no customer-facing refund
UI in this phase, per spec). Full refund (`amount` omitted → refunds the
entire remaining balance) and partial refund (explicit `amount`, capped at
`payment.amount - payment.refundedAmount`) share one path.
`Payment.status` becomes `partially_refunded` until `refundedAmount`
reaches `amount`, then `refunded`. Verified: a full refund correctly
transitioned `succeeded → refunded`; a second refund attempt on an already-
fully-refunded payment was rejected (`PAYMENT_NOT_REFUNDABLE`); a duplicate
refund request with the same `idempotencyKey` returned the existing refund
without a second provider call; two sequential partial refunds (half, then
the remainder) correctly summed to the full amount.

## Payment status endpoint

`GET /orders/:id/payment-status` — `{orderStatus, paymentStatus}`, for a
"processing your payment" screen to poll rather than assuming success the
instant the client-side provider callback fires.

## What's explicitly NOT here yet (by design, not oversight)

- **A live Stripe integration** — the adapter shape exists; no credentials,
  no real logic, by design (see Provider abstraction above).
- **Scheduled reconciliation** — the spec asks for a reconciliation
  *design*, not a running job: compare `Payment.providerPaymentId`/
  `amount`/`status` against the provider's own record for a payment,
  flagging drift. No job scheduler exists in this project (same limitation
  noted since Phase 5's inventory-reservation expiry), so this is a manual
  operation for now, not automated.
- **Customer-initiated refunds** — refund is admin-only; a customer-facing
  return/refund request flow is explicitly out of scope per the spec.
- **Payment method tokenization / saved cards** — Razorpay's hosted
  checkout handles card entry entirely outside this backend; no card data
  of any kind is ever received or stored here.
- **Provider failover** — the factory can select a provider, but nothing
  automatically falls back from Razorpay to Stripe on a timeout (correctly,
  per rule #63 — an uncertain result must be reconciled with the original
  provider before ever considering a second one, not treated as failure).
