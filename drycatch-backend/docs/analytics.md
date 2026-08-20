# Analytics (Phase 17)

## Pre-implementation audit

| | Finding |
|---|---|
| Queue/broker | None. Only Phase 16's in-process `eventBus` (EventEmitter + outbox). Reused directly — analytics subscribes to the same bus, no second event system built. |
| Redis/cache | None. `utils/analyticsCache.js` is an honest in-process TTL Map, documented as non-distributed. |
| Existing behavioral tracking | `SearchEvent` (Phase 13) — reused as-is for search analytics, not duplicated. |
| Existing notification analytics | `services/notifications/analyticsService.js` (Phase 16) — reused directly for the notifications category, not duplicated. |
| Multi-tenant | None — single-store deployment (confirmed and documented in every earlier phase). Analytics code paths never trust a client-supplied tenantId regardless. |
| Admin dashboard | Phase 14's `/admin/dashboard` (`analytics.read`) left untouched — Phase 17 adds a parallel, richer `/admin/analytics/*` surface rather than rewriting it. |
| RBAC | Extended `PERMISSIONS.ANALYTICS` (previously just `analytics.read`) with granular per-category permissions; added `ANALYTICS_MANAGER` role. |

**EXISTING** (reused, not rebuilt): `eventBus.js`, RBAC/`requirePermission`, `protect`/`adminOnly`/`optionalAuth`, `logAuditEvent`, `SearchEvent`, Phase 16's notification analytics, `express-rate-limit`.
**MISSING** (built this phase): raw behavioral event store, daily aggregate tables, incremental worker, central metric definitions, per-category analytics services, export/report/reconciliation/rebuild pipelines, RBAC granularity, admin UI.
**CREATE**: everything listed above.
**REFACTOR**: none of Phases 0–16 were rewritten; only `utils/notificationEvents.js` and `services/notifications/rules.js`/`contentDefaults.js` gained one new event type (`REPORT_READY`) to reuse the existing notification pipeline for report delivery.

## Architecture

```
Business modules (Order/Payment/Shipment/...)
        │ eventBus.publish() — already existed from Phase 16
        ▼
analyticsWorker.js (subscribes to the SAME bus notificationEngine uses)
        │ re-fetches minimal fields from Order/Payment/Shipment by id
        ▼
Daily aggregate tables (DailySalesMetric, ProductDailyMetric, ...)
        │
        ▼
Per-category analytics services (sales/orders/customers/products/...)
        │
        ▼
Admin Analytics API  →  Admin Dashboard (charts/tables/reports/exports)

Client (browser)
        │ POST /api/v1/analytics/events (PAGE_VIEW, PRODUCT_VIEW, ADD_TO_CART, ...)
        ▼
eventIngestionService.js → validate → AnalyticsEvent (raw store) or AnalyticsEventDLQ
        │
        ▼
analyticsWorker.processBehavioralEvent() → FunnelDailyMetric / ProductDailyMetric.views
```

No queue/broker/ClickHouse/BigQuery was introduced (rule #161) — MongoDB
aggregation pipelines over indexed daily-grain collections handle this
project's current scale. The abstraction (one service per category, one
central `metricService.js`) is what lets storage evolve later without
touching every caller.

## Data model

Raw layer: `AnalyticsEvent` (client-instrumented behavioral events,
`eventId` unique for idempotency), `AnalyticsEventDLQ` (malformed events).

Daily aggregates (one row per business day, `dateKey` = store-timezone
`YYYY-MM-DD` via `utils/businessDate.js`): `DailySalesMetric`,
`ProductDailyMetric`, `CategoryDailyMetric`, `CustomerDailyMetric`,
`PaymentDailyMetric`, `ShippingDailyMetric`, `DiscountDailyMetric`,
`FunnelDailyMetric`, backed by `VisitorDaily` (exact distinct-visitor
counting — a running counter alone can't distinguish new-today from
already-counted).

Only the **day** granularity is materialized (rule #64 — "only create
granularities that are actually required"); week/month/year views sum
daily rows at query time rather than maintaining three parallel tables.

Operational: `AnalyticsExportJob`, `AnalyticsReport`.

## Incremental aggregation (the analytics worker)

`services/analytics/analyticsWorker.js` subscribes to the **same**
`eventBus` Phase 16's `notificationEngine` uses — `ORDER_CREATED`,
`ORDER_CANCELLED`, `PAYMENT_SUCCESSFUL`, `PAYMENT_FAILED`,
`REFUND_COMPLETED`, `SHIPMENT_CREATED`, `ORDER_DELIVERED`. Every handler
does an `$inc` upsert against the relevant day's aggregate row — never a
recompute of history (rule #69). Behavioral events go through
`processBehavioralEvent()` for funnel/product-view counters.

**Known gaps, documented rather than faked**:
- `ORDER_CANCELLED`/`RETURNED` shipment-side counts aren't wired — no
  domain event exists for shipment cancellation in Phase 16's rule set.
- Shipping `delayed` count is a **live gauge** (queried directly against
  `Shipment` at read time), not a day-bucketed metric — no domain event
  exists for "this shipment just became late."
- Delivery-time percentiles use a capped 500-sample/day reservoir, not
  every delivery — documented approximation, not exact.

## Central metric definitions (`metricService.js`)

Every formula lives in exactly one place:
- **Gross Sales** = sum of order subtotal (before discount/refund).
- **Net Sales** = gross sales − discounts − refunds.
- **AOV** = net sales / (orders − cancelled orders).
- **Conversion Rate** = orders completed / visitors (from the funnel
  aggregate).
- **Historical CLV** = total net revenue / distinct purchasing customers.
  **Predictive CLV and Cohort CLV are NOT implemented** — no statistical
  projection model exists in this codebase; returned as `null` with an
  explicit reason rather than a fabricated number (rule #18).
- **Percentile** (P50/P90/P95 delivery time) — linear interpolation over
  the sampled array.

## Timezone / business day

All timestamps stay UTC in MongoDB. `utils/businessDate.js` buckets every
aggregate write into a store-timezone business day
(`STORE_TIMEZONE_OFFSET_MINUTES`, default IST). This project is
single-store (documented throughout every phase) — a real multi-tenant
rollout would look this up per store instead of one env var.

## Date ranges & comparison

`utils/dateRange.js` centralizes every preset (today/yesterday/last7/
last30/last90/thisMonth/lastMonth/thisYear/custom) plus the previous-period
comparison window every sales/customer/payment endpoint returns. Custom
ranges are capped at 366 days (rule #130).

## Reused, not duplicated

- **Search analytics** queries Phase 13's `SearchEvent` directly.
- **Notification analytics** calls Phase 16's
  `services/notifications/analyticsService.js` functions directly.
- **Order status distribution**, **review analytics**, and **inventory
  analytics** are direct, indexed queries against `Order`/`Review`/
  `Inventory` rather than a duplicate daily aggregate — each of those
  collections already has the exact index the query pattern needs, so a
  parallel aggregate table would be pure duplication (documented exception
  to the "never scan transactional tables" principle: it's cheap
  specifically because the index already exists for this access pattern).

## Reports & delivery (reuses Phase 16)

`AnalyticsReport` + `reportService.js` generate a report snapshot on
demand (`POST /admin/analytics/reports/:id/run` — no real scheduler
exists, consistent with every earlier phase). Delivery reuses Phase 16's
notification pipeline via a new `REPORT_READY` event/rule rather than
building a second delivery mechanism (rule #84's "reports can be delivered
through... notification").

## Reconciliation & rebuild

`reconciliationService.reconcileDay/Range` compares the transactional
source (`Order`) against the derived aggregate (`DailySalesMetric`) for a
day, flagging drift (rule #71). `rebuildService.rebuildRange` recomputes
aggregates **from source tables** (Order/Payment/Shipment), never from
`AnalyticsEvent` — the raw event store only exists going forward from this
phase's deployment and can't reconstruct pre-Phase-17 history, so rebuild
is the authoritative backfill path (rule #72/#116/#124). Gated by a
dedicated `analytics.rebuild` permission, separate from ordinary
`analytics.read`.

## Exports

`AnalyticsExportJob` — CSV only (Excel/PDF explicitly not implemented,
rule #145's "only if required"). Generated synchronously today (no real
queue to hand off to, same honest-scope note as Phase 16's export
lifecycle) but modeled with pending/processing/completed/failed states so
a real queue can be swapped in later without touching a caller.
`utils/csvExport.js` guards against Excel-formula-injection (`=`, `+`, `-`,
`@`-prefixed cells get a leading `'`). Downloads require a short-lived,
unguessable `downloadToken` — not just the job's Mongo `_id`.

## RBAC

`PERMISSIONS.ANALYTICS` extended from a single `analytics.read` to:
`analytics.sales.read`, `analytics.customers.read`, `analytics.products.read`,
`analytics.inventory.read`, `analytics.payments.read`, `analytics.shipping.read`,
`analytics.marketing.read`, `analytics.export`, `analytics.reports.manage`,
`analytics.reports.send`, `analytics.rebuild`. New role: `ANALYTICS_MANAGER`.
The pre-existing `ANALYST`/`FINANCE_MANAGER` roles (Phase 14) keep working
unchanged — they still hold blanket `analytics.read`.

## API

```
GET  /api/v1/admin/analytics/overview        (rule #100 — one composed KPI endpoint)
GET  /api/v1/admin/analytics/sales|revenue
GET  /api/v1/admin/analytics/orders
GET  /api/v1/admin/analytics/customers[/clv|/retention]
GET  /api/v1/admin/analytics/products
GET  /api/v1/admin/analytics/categories
GET  /api/v1/admin/analytics/inventory[/low-stock]
GET  /api/v1/admin/analytics/payments
GET  /api/v1/admin/analytics/shipping
GET  /api/v1/admin/analytics/discounts
GET  /api/v1/admin/analytics/reviews
GET  /api/v1/admin/analytics/search
GET  /api/v1/admin/analytics/notifications
GET  /api/v1/admin/analytics/funnel
GET  /api/v1/admin/analytics/cohorts
POST/GET /api/v1/admin/analytics/exports[/:id][/download]
GET/POST /api/v1/admin/analytics/reports[/:id/run]
GET  /api/v1/admin/analytics/reconcile
POST /api/v1/admin/analytics/rebuild

POST /api/v1/analytics/events[/batch]   (public, optionalAuth, rate-limited 120/min)
```

## Frontend

`src/components/analytics/` — `DateRangePicker`, `MetricCard`, `LineChart`,
`BarChart`, `PieChart`, `FunnelChart`, `CohortTable`, `DataTable`. All
dependency-free SVG/CSS (no charting library existed in this project and
one date-range page doesn't justify adding one). `src/pages/admin/analytics/`
— Overview, Sales, Customers, Products, Inventory, Payments, Shipping,
Discounts, Funnel, Cohorts, Reports. `src/utils/analyticsClient.js`
instruments `PRODUCT_VIEW` (product detail page mount), `ADD_TO_CART`
(first add), `CHECKOUT_STARTED`/`PAYMENT_STARTED` (checkout flow) —
the funnel's later stages (`PURCHASE`) are covered server-side by the
already-reliable `ORDER_CREATED`/`PAYMENT_SUCCESSFUL` domain events, not
by client instrumentation.

## What's explicitly not built (Phase 18 readiness)

- Funnel/cohort segmentation by device/traffic-source/UTM/campaign — the
  fields exist on `AnalyticsEvent` but aggregates aren't broken down by
  them yet (would multiply aggregate cardinality; deferred rather than
  built speculatively, rule #64).
- Predictive CLV / Cohort CLV.
- Multi-currency (this project is single-currency, INR).
- Profit/COGS-based margin analytics — no cost-price data exists anywhere
  in the product/variant schema; never fabricated.
- Excel/PDF export formats.
- A real job queue/scheduler for exports, reports, and retries — every
  "async"/"scheduled" operation in this system is admin-triggered or
  processed synchronously in-process, consistent with every earlier phase.
- Search-to-purchase attribution (SearchEvent stops at add-to-cart, no
  order-level "sourced from search" field exists).
