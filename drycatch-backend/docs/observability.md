# Observability (Phase 22)

## Audit — what existed before this phase

| Signal | Status | Finding |
|---|---|---|
| Request IDs | **NOT IMPLEMENTED** | Zero request-ID generation/propagation anywhere. **This corrects an overstatement in Phase 18's own final report**, which claimed "request IDs already exist" — they didn't. Verified by grepping the entire middleware/app layer; the only `crypto.randomUUID()` call in the whole codebase was for an unrelated guest-cart cookie ID. |
| Structured logging | PARTIAL | `errorHandler.js` already emitted one well-structured JSON log line for every unhandled error (timestamp/level/method/path/status/message) — a solid foundation, just with no requestId to correlate it to anything and no redaction. Everywhere else: ad-hoc `console.log`/`console.error` (12 call sites), no structure. |
| Error tracking | PARTIAL | Errors were logged server-side and safely sanitized before reaching the client (Phase 18 already got this right — no stack traces leak in production). No external error-tracking service (Sentry etc.) — none chosen, no hosting target (Phase 21). |
| Metrics | NOT IMPLEMENTED | Zero metrics of any kind — no request counters, no latency histograms, no business counters. |
| Distributed tracing | NOT IMPLEMENTED | No tracing library, no spans, no trace propagation. |
| Health/readiness | ADEQUATE | `/health` (liveness) and `/ready` (DB connectivity) already existed and are correctly distinct (Phase 21 confirmed this). |
| Slow query visibility | NOT IMPLEMENTED | No query timing anywhere. |
| Business events | PARTIAL | `logAuditEvent` (Phase 1) already records structured "what admin/user did what" events to the database (login, password change, admin actions) — a real, working business-event log, just not unified with the new request-correlated logger. Phase 16's notification events and Phase 17's analytics events are further, separate event streams already covering "what happened in the business," each for its own purpose. |
| Frontend observability | NOT IMPLEMENTED | No error boundary reporting to a backend, no RUM, no Web Vitals collection beyond what Phase 19 measured manually via `npm run build`. |
| Dashboards/alerting/synthetic/uptime monitoring | NOT IMPLEMENTED | No metrics backend, no hosting target — nothing exists to dashboard or alert from yet (same root cause as Phase 21's finding). |

## What was built this phase (real, verified, working)

### 1. Request ID + context propagation (`src/middleware/requestContext.js`)
Every request gets a stable ID — honored from an upstream `x-request-id`
header if present (so a future edge/CDN layer's ID survives end-to-end),
generated fresh otherwise. Returned to the client via the same response
header (rule #7's "client → gateway → API" flow). Available anywhere in
the request's async call chain via `AsyncLocalStorage`, not just to code
that has `req` in scope — this is what lets the logger attach `requestId`
to every log line without every function signature threading `req`
through.

**Verified live**: `curl -H "x-request-id: my-custom-id-123" .../health`
returns that exact ID back in the response header; without the header, a
fresh UUID is generated. A deliberately malformed request
(`POST /auth/login` with broken JSON) produced an error response with
`requestId: "7071cd24-..."` and a server-side log line carrying the
**identical** `requestId` — real proof of correlation, not just code that
compiles.

### 2. Structured logger with redaction (`src/utils/logger.js`)
One JSON-line-per-event logger: `timestamp`, `level`, `service`,
`environment`, `requestId` (pulled automatically from the async context),
`message`, plus caller-supplied context. Five levels (`debug`/`info`/
`warn`/`error`/`fatal`) gated by `LOG_LEVEL`. Recursive redaction (rule
#13) strips any field whose name contains `password`/`token`/`secret`/
`authorization`/`cookie`/`cvv`/`cardnumber`/`apikey`/`otp` (case- and
separator-insensitive), at any nesting depth, including inside arrays,
with circular-reference protection.

**A real bug caught and fixed during this pass**: the first redaction
pattern used a bare `/card/i` substring match, which would have
false-positive-redacted unrelated fields like `discardedAt`. Fixed to use
`cardnumber` specifically, and a regression test
(`tests/unit/logger.test.js`) locks in exactly this case so it can't
silently reappear.

**Not done**: this does NOT retroactively rewrite the 12 pre-existing
`console.log`/`console.error` call sites elsewhere in the codebase — that
would be a sweep across working code for a cosmetic-logging-format change,
not justified by itself (change-minimization principle, same reasoning as
Phase 21's config module). New code and the request/error lifecycle use
the new logger; the pre-existing scattered calls are documented technical
debt, not silently migrated.

### 3. Standardized error serialization (`serializeError` in `logger.js`)
Every logged error now carries `errorType`, `errorMessage`, `errorCode`,
`statusCode`, and `stack` (server-side only, still never in the client
response) — wired into `errorHandler.js`, replacing its previous
bare `console.error(JSON.stringify(...))` with the redacted, requestId-
correlated logger. Error **responses** now also include `requestId` (never
the stack) — the bridge between "a customer reports a bug" and "an
engineer greps a log for the exact request," which didn't exist before
(there was no ID to grep for).

### 4. HTTP metrics — RED method (`src/utils/metrics.js`, `/metrics` endpoint)
Uses `prom-client` (the standard Node Prometheus client — Prometheus
exposition format is vendor-neutral, keeping instrumentation portable per
rule #80, not locked to a specific SaaS observability vendor this project
hasn't chosen). Tracks, per request: `drycatch_http_requests_total`,
`drycatch_http_request_duration_seconds` (histogram, so p50/p95/p99 are
derivable), `drycatch_http_errors_total` — labeled by **method + matched
route pattern + status class** (e.g. `/api/v1/orders/:id`, `2xx`), never
by orderId/userId/requestId (rule #17/#63's explicit high-cardinality
warning). Default process metrics (CPU, memory, event-loop lag) are
included via `collectDefaultMetrics` — the USE-method infrastructure
signals.

**Verified live**: `curl localhost:5000/metrics` returns real Prometheus
text-format output with non-zero counters after a handful of requests.

### 5. Business/operational counters
Distinct from Phase 17's analytics (which answers "how is the business
doing over a date range" for a dashboard) — these answer "is the
pipeline healthy right now," an operational question:
- `drycatch_checkout_outcome_total{outcome}` — `order_created` /
  `inventory_failed` / `payment_init_failed`, incremented in
  `orderService.createOrderFromItems` at the exact points those outcomes
  are already determined.
- `drycatch_payment_outcome_total{outcome,provider}` — incremented in
  `paymentService.markSucceeded`/`markFailed`.
- `drycatch_webhook_outcome_total{provider,outcome}` — `processed` /
  `duplicate` / `invalid_signature` / `ignored`, incremented at each of
  `handleWebhookEvent`'s existing branch points (Phase 8's webhook
  idempotency logic, unchanged — only instrumented).
- `drycatch_inventory_reservation_outcome_total{outcome}` — `reserved` /
  `insufficient_stock`, incremented in `inventoryService.reserveStock`.

### 6. Slow-query logging (`src/config/db.js`)
Patches `mongoose.Query.prototype.exec` and `Aggregate.prototype.exec`
once, at the shared-prototype level — deliberately not per-schema `pre`/
`post` hooks, which would need registering before each model's schema
compiles; by the time `connectDB()` runs, most models are already
imported via the route → controller → service chain, so per-schema hooks
would silently miss most queries. The prototype patch catches every query
regardless of import order. Logs only queries at or above
`SLOW_QUERY_THRESHOLD_MS` (default 200ms) — logging every query at full
volume is exactly the "uncontrolled observability cost" rule #64 warns
against.

**Verified live, not just in theory**: the very first boot after adding
this caught a real slow query — `seedRoles`' `findOneAndUpdate` against
the `roles` collection took 332ms (and 246ms on a second boot), logged
automatically with no test scaffolding involved. This is exactly the kind
of signal this feature exists to surface.

## Golden signals / RED / USE — applied

- **Latency**: `drycatch_http_request_duration_seconds` histogram (p50/p95/p99 derivable).
- **Traffic**: `drycatch_http_requests_total`.
- **Errors**: `drycatch_http_errors_total` + per-outcome business counters above.
- **Saturation**: default process metrics (event-loop lag, memory) via `collectDefaultMetrics`; no database-connection-pool-saturation metric yet (Mongoose exposes this, not wired up this pass — documented gap).

## What's documented as a plan, not built (same root cause as Phases 19/21)

No metrics backend (Prometheus/Grafana/Datadog/etc.), no log aggregator,
no error-tracking SaaS, no APM/tracing backend, and no hosting target
exist for this project (confirmed repeatedly since Phase 19). Building
dashboards, alerts, synthetic monitors, or uptime checks against
infrastructure that doesn't exist would be fabrication, not
implementation. What's real today:

- **`/metrics` is real and scrapable** the moment any Prometheus-compatible
  backend is pointed at it — this is the actual deliverable that makes
  "dashboards" and "alerts" a configuration exercise later, not a rebuild.
- **Distributed tracing**: not implemented. The request-ID/AsyncLocalStorage
  foundation this phase built is the same mechanism a real tracer
  (OpenTelemetry) would use for context propagation — adding real spans
  is additive on top of this, not a rearchitecture, when a tracing backend
  is chosen.
- **Frontend observability (RUM, Core Web Vitals, JS error capture)**: not
  implemented — needs a frontend error-reporting endpoint or a third-party
  SDK, neither of which exists. Phase 19 already measured Web Vitals
  manually via build output; continuous RUM requires a collection backend.
- **Synthetic/uptime monitoring**: requires an external service (or at
  minimum, a deployed URL to check) — neither exists (Phase 21).
- **SLI/SLO with error budgets**: defined qualitatively below; without a
  metrics backend retaining history, there's nowhere to compute an actual
  burn rate yet.
- **Dashboards** (application/checkout/payment/database/queue/deployment):
  described below as *what each dashboard should show once a backend
  exists to build it in* — not fabricated screenshots or config for a
  tool that isn't installed.

### SLIs / SLOs (targets, not yet measurable against real traffic)
- **API success rate** (non-5xx / total) — target 99.5%.
- **Checkout success rate** (`order_created` / all checkout outcomes) — target 99%.
- **Payment success rate** (`succeeded` / all payment outcomes) — target 97% (payment failures include genuine card declines, not just system faults, so 100% is never the right target — rule #40's own warning).
- **p95 API latency** — target under 500ms for `/products`, `/checkout/*`, `/orders`.
These are identical in spirit to Phase 19's SLOs, now backed by an actual
metric (`drycatch_http_request_duration_seconds`,
`drycatch_checkout_outcome_total`, `drycatch_payment_outcome_total`) that
didn't exist when Phase 19 wrote its targets down.

### Dashboard specifications (build these panels once a backend exists)
- **Application**: request rate, error rate, p50/p95/p99 latency by route, top failing routes — all directly from `drycatch_http_*`.
- **Checkout**: `drycatch_checkout_outcome_total` by outcome over time — answers "why is checkout failing" without opening a trace.
- **Payment**: `drycatch_payment_outcome_total` by outcome/provider, `drycatch_webhook_outcome_total` by outcome — answers "is the payment pipeline healthy."
- **Database**: slow-query log volume over time (from the new `db.js` instrumentation), once log aggregation exists to graph it.
- **Deployment**: not correlatable yet — no deployment-version tag exists in any metric because there's no CI/CD deploy stage emitting one (Phase 21 finding, unchanged).

### Alerting (severities defined, routing/escalation deferred — no alerting backend exists)
- **CRITICAL**: `drycatch_http_errors_total` rate spike on checkout/payment routes; `/ready` failing.
- **HIGH**: payment success rate drop; webhook `invalid_signature` rate spike (possible attack, ties to Phase 18).
- **WARNING**: slow-query log volume increase; inventory `insufficient_stock` rate spike (possible oversell-adjacent restocking need, not a bug).
- **INFO**: none configured — avoiding alert fatigue per rule #51's explicit "alert on customer impact, not every metric movement."

## Data privacy / access control

Everything logged goes through `redact()` — verified by the false-positive
regression test above and the original redaction-coverage tests. `/metrics`
carries no PII (bounded label sets only). No access-control layer exists
on `/metrics` yet — documented in the endpoint's own comment: put it
behind the reverse proxy/firewall Phase 21 already described, not
application-level auth, once a real network boundary exists to enforce
one behind.

## Developer observability guide (how to use what this phase built)

- **Logging**: `import { logger } from "../utils/logger.js"; logger.info("message", { contextField: value })`. Never pass a raw `req`/`user`/`payment` object directly without checking what it contains — `redact()` catches known-sensitive field *names*, not arbitrary sensitive *values* in innocuously-named fields.
- **Metrics**: add a new counter/histogram in `utils/metrics.js` only for a genuinely new operational question ("is X healthy"), not per-feature by default — mirrors the four business counters added this phase, each tied to a real failure mode already discussed in an earlier phase's report.
- **Never** create a metric label from a userId/orderId/email/requestId — use the route pattern, a status class, or a small fixed enum of outcomes.

## Feature observability checklist (apply to every future phase)

1. What can fail? 2. How would we detect it today (log/metric)? 3. Does the failure need a NEW counter, or does an existing one already cover it? 4. Is any new logged field going through `redact()` correctly? 5. Would an engineer with only `/metrics` and structured logs (no dashboard, no tracing) be able to find this failure's root cause?

## Score

Logging: 7/10 (real, structured, redacted, correlated — legacy console calls unmigrated)
Log Quality: 7/10
Log Searchability: 2/10 (no aggregation backend — structured JSON lines are ready to ingest the moment one exists)
Sensitive Data Protection: 8/10 (verified via regression test, including a real false-positive bug caught and fixed)
Metrics: 6/10 (RED for HTTP + 4 real business counters; no DB/queue-depth metrics since no queue exists)
API Observability: 7/10
Database Observability: 6/10 (slow-query logging verified live; no connection-pool-saturation metric yet)
Distributed Tracing: 1/10 (foundation only — AsyncLocalStorage context, no spans)
Frontend Observability: 0/10 (not built — no backend to send telemetry to)
Business Observability: 6/10 (4 operational counters; audit log/analytics/notification event streams already existed and are now documented as distinct from these)
Synthetic/Uptime Monitoring: 0/10 (no hosting target — Phase 21's finding, unchanged)
Dashboards: 1/10 (specified, not built — no backend)
Alerting: 1/10 (severities defined, nothing wired — no backend)
SLO Management: 4/10 (targets defined against real metrics for the first time this phase; no historical burn-rate tracking)
Observability Testing: 6/10 (7 real unit tests on redaction; metrics/request-ID verified via live curl, not just unit tests)
Cost Efficiency: 8/10 (slow-query threshold, bounded metric labels, no blanket verbose logging — deliberately controlled)

**Overall: 5/10** — real, verified, working telemetry foundation
(request IDs, structured+redacted logging, RED metrics, slow-query
detection, business counters) everywhere the codebase itself could
provide it, honestly low scores everywhere a missing metrics/tracing/
alerting backend — the same unresolved hosting decision from Phases
19/21 — is the actual blocker, not fabricated dashboards for tools that
aren't installed.
