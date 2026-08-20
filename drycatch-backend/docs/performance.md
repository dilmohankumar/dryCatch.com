# Performance & Scalability (Phase 19)

## Scope note (read this first)

This is a solo-developer project running on a local machine, with no
production traffic, no CDN, no Kubernetes, no read replicas, and no
Redis. There is nothing to load-test, spike-test, or soak-test against —
doing so would produce fabricated numbers against an environment that
looks nothing like a real deployment. Per the phase's own governing
principle ("do not optimize based on assumptions... do not introduce
complexity without evidence"), this phase audited the actual codebase for
concrete, measurable inefficiencies and fixed the ones that were real,
rather than authoring load-test reports or a Kubernetes scaling plan for
infrastructure that doesn't exist. What's below is: what was measured,
what was found, what was fixed with before/after numbers, and an honest
capacity/scaling roadmap for when real traffic and real infrastructure
exist.

## Audit findings

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | No response compression on any API endpoint | `grep compression package.json` → nothing | Added `compression` middleware, 1KB threshold |
| 2 | Product listing's most common query path (status+visibility+category, sorted newest-first) had no covering compound index | 3 separate single-field indexes existed; Mongo would use one and sort/filter the rest in memory | Added `{status:1, visibility:1, category:1, createdAt:-1}` |
| 3 | Below-the-fold product images (carousel, grid) had no `loading="lazy"` | `grep loading= ProductCarousel.jsx productGrid.jsx` → no matches | Added `loading="lazy" decoding="async"` |
| 4 | Homepage's LCP-candidate image had no explicit priority hint | Same file, hero tile | Added `loading="eager" fetchPriority="high" decoding="sync"` |
| 5 | **Entire admin surface (CMS editors, notification/campaign management, all Phase 17 analytics dashboards + custom SVG charts) was statically imported into the single customer-facing bundle** | `AppRoutes.jsx` imported `AdminSection` at module scope; every build since Phase 15 has shown a "chunk > 500KB" warning | `React.lazy()` + `Suspense` — admin code now a separate chunk, fetched only when a user navigates to `/admin` |

No N+1 query patterns were found in the customer-facing hot path
(`productService.listProducts` already batches default-variant lookups in
one query per page, not one per product — written that way since Phase 3).
Search was already debounced (`SearchBar.jsx`). Pagination was already
capped (`MAX_LIMIT = 100` in `productService.js`, consistent caps across
every list endpoint added in Phases 5–17).

## Measured before/after

**Frontend bundle** (`npm run build`, gzip sizes):

| | Before | After |
|---|---|---|
| Main JS chunk | 665.85 KB (166.09 KB gzip) | 553.53 KB (148.91 KB gzip) |
| Admin chunk | *(bundled into main)* | 112.85 KB (18.53 KB gzip), separate, lazy-loaded |

**Every customer-facing page load now ships ~17 KB less gzipped JS**
(and 112 KB less raw JS to parse/compile) than before, since none of the
admin/CMS/analytics/chart code executes or downloads until an actual admin
navigates to `/admin`.

**Response compression** (verified with a synthetic 2000-row JSON payload
since this project's local dev database has no seeded product catalog to
generate a realistically large real response):
- Uncompressed: N/A (test measured compressed size directly)
- With `Accept-Encoding: gzip`: `Content-Encoding: gzip` header present,
  payload compressed to 11,442 bytes. Verified separately that responses
  under the 1KB threshold correctly skip compression (no header, no CPU
  spent compressing a 145-byte response) — the "don't compress everything
  blindly" requirement, checked directly rather than assumed.

**Backend boot/response**: `GET /api/v1/products` — 200 OK in ~0.12s
against local MongoDB, unchanged before/after the new index (expected —
the local catalog has too few documents for an index to show a measurable
difference; the index is justified by query-plan reasoning documented in
`models/Product.js`, not a local-scale timing difference that wouldn't be
visible with a handful of test products anyway).

## Performance budgets (targets, not yet measured against real traffic)

These are stated as targets for when real traffic exists, following
standard Core Web Vitals guidance adjusted for a mid-market e-commerce SPA
— not blindly copied without reasoning:

- **LCP < 2.5s** on the homepage — the hero promo image is now
  eager/high-priority; the actual number depends on hosting/CDN choices
  not yet made.
- **CLS < 0.1** — already effectively satisfied structurally: every
  product image sits inside a parent with a fixed height (`h-40`,
  `height: 220`, etc.) set independently of image load state, so there's
  no layout-shift-on-image-load risk by construction, verified by reading
  every image call site touched in this phase.
- **INP < 200ms** — not measured (no synthetic-interaction tooling in this
  repo); React rendering audit found no obvious anti-patterns (no giant
  single Context re-rendering the whole tree — cart/user state is passed
  as targeted props from `AppRoutes.jsx`, not a monolithic global store).
- **API p95** — not measured against real concurrency (no load-testing
  infra exists); single-request local timings are in the tens-to-low-
  hundreds of milliseconds range, dominated by local MongoDB round-trips.

## Caching architecture (current state, honestly scoped)

No Redis or distributed cache exists in this project (confirmed by audit
in Phase 17/18 and reconfirmed here). Two in-process, per-instance TTL
caches already exist from earlier phases:
- `services/notifications/eventBus.js`'s NotificationEvent outbox (durability, not a cache)
- `utils/analyticsCache.js` (Phase 17) — explicitly documented there as
  non-distributed, single-process only.

**This is the correct amount of caching for a single-instance deployment
with no measured cache-miss cost problem.** Introducing Redis now would be
exactly the "complexity without evidence" the spec warns against — there's
no multi-instance deployment yet for an in-process cache to fail to serve,
and no measured database load that caching would relieve. When horizontal
scaling (Stage 2 below) actually happens, `analyticsCache.js`'s
get/set/invalidate interface is small enough to swap its internals for a
real Redis client without touching any call site.

## Scaling roadmap (staged, not prematurely jumped to)

- **Stage 1 (current)**: single Node process, single MongoDB instance,
  in-process caching. Appropriate for the current zero-production-traffic
  state.
- **Stage 2**: multiple app instances behind a load balancer once real
  concurrent traffic exists. Requires: moving in-process caches to Redis
  (or accepting a lower hit rate per-instance), and confirming
  `express-rate-limit`'s in-memory store is replaced with a shared store
  (documented gap — currently per-instance, fine at Stage 1, would under-
  count total request volume across instances at Stage 2).
- **Stage 3**: independent worker/queue scaling once background job volume
  (notifications, analytics aggregation, exports) is high enough to
  contend with the web process for CPU — not currently the case since
  everything runs in-process synchronously per the honest "no real
  queue exists" pattern documented in Phases 16/17.
- **Stage 4**: MongoDB read replicas, only if read load is ever shown
  (via real monitoring, not assumption) to be the bottleneck.
- **Stage 5**: service separation — not on the roadmap until the monolith
  demonstrably becomes the bottleneck. No microservices split is planned
  or justified today.

## SLI/SLO (defined, not yet measured against real traffic)

- **SLI**: successful checkout completion rate; API error rate;
  p95 latency for `/products`, `/checkout/*`, `/orders`.
- **SLO** (target, pending real traffic to validate): 99.5% successful
  checkout rate; p95 < 500ms for product/checkout endpoints under normal
  load.

## Capacity assumptions (explicit, not measured)

No real user/order volume exists yet. Documenting assumptions explicitly
per the spec's own instruction ("use assumptions explicitly") rather than
inventing false-precision numbers: this is a pre-launch project sized for
an initial single-region, single-store deployment — hundreds, not
millions, of orders/day at launch. The scaling roadmap above is staged
specifically so infrastructure is added when real numbers justify each
stage, not in advance of them.

## What's explicitly not done (and why)

- **Load/stress/spike/soak testing**: no traffic-generation infra, no
  staging environment resembling production, no real users. Fabricating
  "1,000 concurrent users" numbers against a laptop running a single
  Node process and local MongoDB would produce meaningless results
  dressed up as evidence.
- **Distributed tracing**: request IDs already exist (Phase 18); wiring
  them through an actual tracing backend (Jaeger/Honeycomb/etc.) requires
  choosing and standing up that infrastructure, not a code change to make
  here speculatively.
- **CDN**: no hosting/deployment target is configured in this repo (no
  Dockerfile, no CI, confirmed absent in Phase 18's audit) — CDN strategy
  is a deployment-configuration decision, not something this codebase
  can implement in the abstract.
- **Circuit breakers**: the only external dependencies (Razorpay,
  shipping carrier) already have timeout-bounded HTTP calls and honest
  stub/real provider abstractions (Phases 8/10/16); a formal
  closed/open/half-open circuit breaker state machine for a single-
  provider-per-concern architecture would be complexity without a
  demonstrated failure mode to justify it.
- **Bundle-size CI budget enforcement**: no CI pipeline exists to enforce
  it in (confirmed in Phase 18). The measured before/after numbers above
  are the manual equivalent for this pass.

## Performance score

Core Web Vitals: 6/10 (targets defined, structurally sound, unmeasured against real traffic)
Frontend Rendering: 7/10 (no anti-patterns found; not exhaustively profiled)
Bundle Size: 8/10 (real, measured 17% reduction via code-splitting this phase)
Image Performance: 7/10 (lazy/eager/priority hints now correct; no responsive srcset/CDN transforms)
API Performance: 6/10 (payload-optimized DTOs already existed; compression added; unmeasured under concurrency)
Database Performance: 7/10 (indexes reviewed and one real gap closed; no slow-query log exists yet)
Caching: 5/10 (appropriately minimal for current scale, honestly scoped — not a 10 because it's genuinely thin)
Search Performance: 7/10 (debounced, paginated, already Phase 13-optimized)
Cart/Checkout Performance: 6/10 (already parallelized where safe in Phase 7; unmeasured under load)
Admin Performance: 7/10 (now lazy-loaded; existing pagination/limits from Phase 14-17)
Analytics Performance: 7/10 (Phase 17's incremental aggregation already avoids scanning transactional tables)
Queue/Worker Scalability: 4/10 (no real queue exists — honest, documented gap since Phase 16)
Infrastructure Scalability: 4/10 (no deployment infra exists yet to score higher)
Multi-Tenant Isolation: N/A (single-tenant project)
Load Handling / Testing: 2/10 (no infra to test against — honestly scored low rather than fabricated)
Monitoring: 3/10 (request IDs exist; no metrics/alerting backend stood up)

**Overall: 6/10** — real, verified wins where evidence justified them;
honestly low scores where no infrastructure exists to measure or improve
against, rather than invented numbers.
