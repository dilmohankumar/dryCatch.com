# Notifications (Phase 16)

## Primary objective

A centralized, provider-independent notification system. Business modules
never call an email/SMS/push provider directly — they publish a domain
event, and the notification engine decides what happens next (rules,
preferences, template, channel, delivery, retry). This is the "don't do
`OrderService -> sendEmail()`" principle the phase spec led with.

## Architecture

```
Business module (order/payment/shipment/inventory/review/cms/auth)
        │
        ▼
eventBus.publish(eventType, minimalPayload)
        │
        ├─► NotificationEvent (outbox row, status "pending")
        │
        ▼
in-process EventEmitter fan-out (no real broker exists — see "No queue" below)
        │
        ▼
notificationEngine.handleEvent()
   ├─ rules.js: recipientType, category, priority, default channels, criticalBypassesPreferences
   ├─ preferenceService.isChannelAllowed(): per-channel opt-out, unsubscribe, critical bypass
   ├─ templateService.renderForEvent() (published template) OR contentDefaults.js (built-in copy)
   └─ Notification.create() + deliveryService.createAndProcessDeliveries()
        │
        ▼
NotificationDelivery (one row per channel) ──► channel module ──► provider
   email/sms/push/whatsapp/in_app
```

## No queue/broker exists (honest scope note)

This project has no Redis/BullMQ/Kafka/SQS anywhere (confirmed by audit
before writing a line of this phase). `eventBus.js` is an in-process
`EventEmitter` backed by the `NotificationEvent` outbox table for
durability — the same "lazy check, not a real worker" pattern established
by Cart/Checkout expiry and CMS's scheduled publish in earlier phases.
Concretely:

- `eventBus.publish()` persists the event row, then awaits every
  subscribed listener **synchronously in-process**, in the same request.
- Retries (`deliveryService.processRetries()`) and outbox recovery
  (`eventBus.reprocessPendingEvents()`) are **admin-triggered** via
  `POST /admin/notifications/process-retries` and
  `/reprocess-events` — there is no cron/worker calling these on a
  schedule. A real deployment would wire a `setInterval` or an actual job
  scheduler to call them periodically; documented as a gap, not faked.
- Swapping in a real broker later means replacing `eventBus.js`'s
  internals — every `publish()` call site is unaffected.

## Domain events (`utils/notificationEvents.js`)

`ORDER_CREATED/CONFIRMED/CANCELLED`, `PAYMENT_SUCCESSFUL/FAILED`,
`REFUND_CREATED/COMPLETED`, `SHIPMENT_CREATED`,
`ORDER_SHIPPED/OUT_FOR_DELIVERY/DELIVERED`, `LOW_STOCK/OUT_OF_STOCK/BACK_IN_STOCK`,
`REVIEW_CREATED/APPROVED/REJECTED`, `CONTENT_PUBLISHED/PUBLISH_FAILED`,
`USER_REGISTERED`, `EMAIL_VERIFICATION_REQUIRED`,
`PASSWORD_RESET_REQUESTED/CHANGED`, `LOGIN_SECURITY_ALERT`,
`ABANDONED_CART`, `ADMIN_ALERT`.

Every event payload is minimal — ids only (`orderId`, `userId`,
`orderNumber`), never a full copied document — the notification layer
re-fetches whatever it needs at render time so it always sees current
data.

### Integration points (where `eventBus.publish()` was added)

| Event | File / function |
|---|---|
| `ORDER_CREATED` | `orderService.createOrderFromItems` |
| `ORDER_CONFIRMED` | `paymentService.markSucceeded` (after order flips to confirmed) |
| `ORDER_CANCELLED` | `orderController.cancelOrder` |
| `PAYMENT_SUCCESSFUL` / `PAYMENT_FAILED` | `paymentService.markSucceeded` / `markFailed` |
| `REFUND_CREATED` / `REFUND_COMPLETED` | `paymentService.refundPayment` |
| `SHIPMENT_CREATED` | `shipmentService.createShipment` |
| `ORDER_SHIPPED` / `ORDER_OUT_FOR_DELIVERY` / `ORDER_DELIVERED` | `shipmentService.applyShipmentStatus` (shared webhook + poll path) |
| `LOW_STOCK` / `OUT_OF_STOCK` / `BACK_IN_STOCK` | `inventoryService.checkStockThresholds`, called from `commitReservationsForReference` and `adjustStock` — fires only on the threshold *transition*, not every write |
| `REVIEW_CREATED` | `reviewService.createReview` (only when status is `pending`, i.e. moderation is actually needed) |
| `REVIEW_APPROVED` / `REVIEW_REJECTED` | `reviewModerationService.moderate` |
| `CONTENT_PUBLISHED` | `pageService.transition` / `blogService.transition` (on success) |
| `CONTENT_PUBLISH_FAILED` | `pageAdminController.publish` / `blogAdminController.publish` (catch block — the service throws before persisting, so there's no in-service hook for the failure case) |
| `USER_REGISTERED`, `EMAIL_VERIFICATION_REQUIRED` | `authController.signup` |
| `PASSWORD_RESET_REQUESTED` | `authController.requestPasswordReset` |
| `PASSWORD_CHANGED` | `authController.resetPassword` and `changePassword` |

**Known gap — `LOGIN_SECURITY_ALERT` is not wired.** `authController.login`
has no device/session fingerprinting and no "known devices" list — there is
no data to distinguish a first-time device from a returning one. Wiring
this requires a device-tracking model first; flagged explicitly rather
than faked with a rule that never fires correctly.

**Email verification / password reset don't double-send email.** The
actual OTP/reset code is still sent through the pre-existing
`utils/otp.js` (a security-critical path predating this phase). The
`EMAIL_VERIFICATION_REQUIRED`/`PASSWORD_RESET_REQUESTED` rules deliberately
exclude the `email` channel (`rules.js`) — they exist only so the action
shows up in the Notification Center / audit trail, not as a second,
differently-worded OTP email.

## Rules & preferences

`services/notifications/rules.js` is one lookup table: eventType →
`{recipientType, category, priority, channels, criticalBypassesPreferences}`.
`criticalBypassesPreferences: true` is reserved for security/legal/
transactional-confirmation events (password changes, login alerts, order/
payment confirmations) — marketing never gets this flag.

`preferenceService.js` centralizes default preferences (never scattered
`if (user.emailNotification)` checks). Two levels of granularity:
- `EVENT_TO_GROUP` — per-event overrides (e.g. `ORDER_SHIPPED` →
  `shippingUpdates`, distinct from `ORDER_CREATED` → `orderUpdates`, even
  though both currently share category `transactional`).
- `CATEGORY_TO_GROUP` — fallback for anything not in the per-event map.

Global unsubscribe (`unsubscribedAt`) blocks all `marketing`-category sends
regardless of per-channel toggles, unless `criticalBypassesPreferences` is
set (it never is for marketing).

## Templates

`NotificationTemplate` (draft/published, versioned) + append-only
`NotificationTemplateRevision` (restore creates a **new** revision, same
semantics as CMS's `ContentRevision` — never rewrites history).
`utils/templateRenderer.js` supports exactly `{{variableName}}`
substitution, HTML-escaped by default — no eval, no `Function()`
construction, no server-side includes, so template injection is
structurally impossible rather than merely filtered. Saving/publishing a
template validates every `{{var}}` it references is in its own declared
`variables` list (`TEMPLATE_VARIABLE_MISSING` otherwise).

If no published template exists for an event, `contentDefaults.js`
supplies built-in copy — the system produces sensible notifications with
zero admin setup, and an admin can override any of them later by
publishing a template for the same `(type, channel)`.

## Channels & providers ("honest stub" pattern)

Every channel (`email`, `sms`, `push`/`web_push`, `whatsapp`, `in_app`)
exposes the same contract: `send()` returns
`{success, providerMessageId, status, error, errorClass}`. Behind each
channel is a provider abstraction (`providers/*Provider.js`) with a
**console provider as the real, working default** (genuinely "delivers" by
logging — same honest pattern as `utils/otp.js`) and a structural stub for
the real service (SMTP/nodemailer, Twilio, FCM, WhatsApp Business API)
that throws `PROVIDER_NOT_CONFIGURED` rather than pretending to send.
Swap in a real provider by setting `EMAIL_PROVIDER=smtp` (etc.) once the
corresponding SDK + credentials are actually wired up. `in_app` has no
external provider — the `Notification` document itself is the in-app
record.

`NotificationDelivery` folds what the spec calls a separate
"NotificationProviderLog" into one model (provider, providerMessageId,
errorCode/class, attempt, timestamps all live on the delivery row) —
documented simplification, same reasoning as Phase 15 collapsing revision
history into one `ContentRevision` model.

## Retry, backoff, dead-letter

Backoff: attempt 1 → retry in 1 min, attempt 2 → 5 min, attempt 3 → 30
min, then terminal `failed` (dead letter). Errors are classified
(`temporary`, `permanent`, `rate_limited`, `invalid_recipient`,
`provider_outage`) — a `permanent`/`invalid_recipient` failure never
retries at all (rule: never retry blindly). A suppressed recipient is
`cancelled`, a distinct terminal status from `failed` — it was never
attempted against a provider, so it shouldn't count toward provider
failure-rate metrics.

Dead-letter admin endpoints: list, retry (resets attempt counter), cancel.
No queue infrastructure backs this — `processRetries()` is a lazy poller
over `NotificationDelivery` rows where `status: "retrying"` and
`nextAttemptAt <= now`, called by an admin action.

## Idempotency & deduplication

- `NotificationEvent.eventId` — unique index, the outbox's idempotency key.
- `Notification.dedupeKey` (`eventType:userId:orderId/entityId`) — unique
  sparse index. The same event processed twice (duplicate webhook,
  crash-and-retry) finds the existing `Notification` and returns early
  rather than creating a second one.
- `deliveryService.processDelivery` is itself idempotent — a delivery
  already `sent`/`delivered`/`cancelled` is a no-op on a second call.

## Suppression list

`NotificationSuppression` (channel + value, unique) — bounce/complaint/
unsubscribe/invalid-recipient/manual. Checked by every channel's `send()`
before touching a provider. Admin can list/remove entries.

## Campaigns

`NotificationCampaign` — draft/scheduled/running/paused/completed/
cancelled. Audience is a **query descriptor**
(`{segment: "all"|"new_customers"|"inactive"|"high_value"|"custom", filter}`),
resolved to real users only at send time — never a hard-coded list.
`campaigns.create` and `campaigns.send` are **separate permissions**
(`rbac.js`) — creating a campaign is not itself permission to blast it.
Send respects: global unsubscribe, email suppression list, and a
frequency cap (1 marketing send per channel per recipient per 24h,
centrally enforced in `campaignService.isWithinFrequencyLimit`).

**Documented simplification**: `high_value` segment resolves to "all"
today — it needs an order-total aggregation across the Orders collection
that doesn't exist yet in this service; flagged rather than silently
guessing at a wrong definition.

## Notification Center

Customer: `GET/PATCH /api/v1/notifications/*` — list (paginated, excludes
archived/expired), unread-count (dedicated cheap query, never loads full
docs), mark-read/mark-all-read (ownership-checked — `NOTIFICATION_NOT_FOUND`
if the notification doesn't belong to the caller, preventing IDOR).
Admin: `GET /api/v1/admin/notifications` reads `recipientType: "admin"`
rows — these have no single owning user (**documented scope**: admin
notifications are a shared feed across all admins, not per-admin read
state; a specific admin marking one "read" isn't tracked individually).

## RBAC

New permission group `NOTIFICATIONS`: `notifications.read/send`,
`notifications.templates.manage`, `notifications.campaigns.create/send`,
`notifications.providers.manage`, `notifications.analytics.read`. Two new
default roles: `NOTIFICATIONS_MANAGER` (templates/providers/analytics, no
campaign send) and `CAMPAIGN_MANAGER` (full access including send).

## Public/customer API

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

## Admin API

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

## Security

- Template rendering is placeholder-substitution only, HTML-escaped —
  structurally immune to server-side template injection.
- Provider credentials are never returned in full — `getProviderConfig`
  masks everything but the last 4 characters.
- Every customer read/write is scoped to `req.user._id` at the query
  level, never trusting a client-supplied id (IDOR prevention, verified in
  the scratch test suite).
- Push tokens are masked everywhere except the raw DB row.
- Deep links in push/in-app payloads are plain `data.actionUrl` strings the
  frontend consumes with `onNavigate` (client-side router), not raw HTML —
  no injected markup path.

## Frontend

- `src/components/notifications/NotificationBell.jsx` — header bell,
  polls unread-count every 45s (**no WebSocket/SSE exists**, documented
  Phase 17 readiness gap; this is the "reasonable polling fallback" the
  spec explicitly allows when real-time infra isn't there), dropdown with
  mark-read/mark-all-read.
- `src/pages/account/Notifications.jsx` — full notification feed +
  legacy preference toggles (pre-existing, untouched) + new granular
  channel × category preference matrix.
- `src/pages/admin/notifications/` — `NotificationDashboard` (queue
  health + manual retry/reprocess triggers), `DeliveryLogs`,
  `DeadLetterQueue`, `NotificationTemplates` (create/edit/preview/publish/
  test-send), `Campaigns` (create/send/pause/analytics).

## What's explicitly not built (Phase 17 readiness)

- Real provider SDKs (SMTP/Twilio/FCM/WhatsApp Business API) — structural
  stubs only, swap-in ready.
- Real-time delivery (WebSocket/SSE) — polling fallback only.
- Content localization (`locale` field exists on templates, only `en-IN`
  populated).
- Notification digest/grouping (e.g. "5 products back in stock" instead of
  5 separate notifications).
- Provider webhooks for delivery/bounce/complaint callbacks — the model
  fields exist (`bouncedAt` semantics folded into suppression, `openedAt`/
  `clickedAt` on delivery), but no inbound webhook endpoint verifies a
  real provider's signature yet (no real provider is wired up to send one).
- `high_value` campaign audience segment (documented above).
- Any real background worker/queue — every "scheduled" operation in this
  system remains admin-triggered or lazy-checked, consistent with every
  earlier phase.
