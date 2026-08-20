# Search & Product Discovery (Phase 13)

## The core rule

Search is not `GET /products?search=cashew` with a regex. Product remains
the source of truth; a dedicated, read-optimized projection
(`ProductSearchIndex`) is what search actually queries — `Product
Database → Indexing Pipeline → Search Index → Search Service →
{Search, Autocomplete, Suggestions}`. Nothing here ever reads `Product`
directly for a customer-facing search request.

## Before this phase

Phase 3's catalog listing supported `?search=` via Mongo's `$text` index
directly against `Product` — functional for an MVP, but no autocomplete, no
facets, no synonyms, no merchandising, no ranking beyond raw text score, no
zero-result handling, no analytics. `GET /products` still exists unchanged
for plain catalog browsing; `GET /search` is new and is where all of the
above now lives.

## Provider abstraction (rule #72/#129)

`services/search/providers/` — a six-method contract (`search`, `facets`,
`autocomplete`, `index`/`update`/`remove`/`bulkIndex`, `reindexAll`,
`healthCheck`). `mongoSearchProvider.js` is a **fully working MVP
implementation** (rule #74's explicit "Phase 2: implement database/basic
provider for development") — Mongo's own weighted `$text` index for
full-text search, aggregation `$facet`-style queries for facets, anchored
regex for autocomplete prefix matching (Mongo has no native completion
suggester). `opensearchProvider.js` is an honest structural stub — no
OpenSearch/Elasticsearch cluster exists in this project, same "fails
loudly, never fakes success" rule as Phase 8's Stripe adapter and Phase
10's Shiprocket adapter. `searchProviderFactory.js` resolves
`SEARCH_PROVIDER` (env, default `mongo`) — `searchService.js` never
branches on provider name.

## Search document

`ProductSearchIndex` — one document per product (`unique: {product: 1}`),
containing only discovery-relevant fields: name/description/category
path/tags, every variant's SKU and price (for `minPrice`/`maxPrice` and
exact-SKU search), rating/reviewCount (from Phase 12), inventoryStatus,
popularity/salesCount signals, `isActive`/`isPublished` gates. Weighted
text index: `name: 10, category: 6, tags/keywords: 4, shortDescription: 2,
description: 1` (rule #7/#8) — not every field is equally relevant.

## Indexing — synchronous, not queued (an honest gap)

`indexingService.js` — `indexProduct`/`updateProductIndex`/
`deleteProductIndex`/`bulkIndex`/`reindexAll`/`reconcile`. Hooked directly
into `productService.createProduct/updateProduct/archiveProduct`,
`variantService.createVariant/updateVariant/archiveVariant` (variant price/
SKU feed the product's search doc), and Phase 12's
`ratingAggregationService` (rating/reviewCount are ranking signals).
**Rule #64 calls for event-driven indexing through a queue** — no queue
infrastructure (BullMQ/RabbitMQ/SQS) exists anywhere in this project (same
limitation noted for background jobs since Phase 5), so these are direct,
synchronous calls, wrapped in `.catch(() => {})` so an indexing failure
never fails the product/variant write itself. This is the honest gap a
real deployment would close by pushing these onto a retryable queue with
a dead-letter path (rule #66/#67) instead.

## Reconciliation (rule #126/#127)

`indexingService.reconcile()` — compares `Product` ids against
`ProductSearchIndex` ids, re-indexes anything missing, removes anything
orphaned. Exposed as an admin-triggered endpoint
(`POST /admin/search/reconcile`) rather than a scheduled job, for the same
"no job scheduler in this project" reason. Verified: manually deleting one
product's index document and running reconcile correctly rebuilt it.

## Full-text search, synonyms, typo tolerance

`searchService.search()` expands the query through `synonymService.
expandQuery` (admin-configured `SearchSynonym` documents — "kaju" → also
matches "cashew" — never hard-coded into application code, rule #13)
before handing the expanded text to the provider. Verified: searching
"kaju" with a `kaju→cashew` synonym configured found "Roasted Cashews".
Typo tolerance is intentionally narrow — Mongo's `$text` doesn't do fuzzy
matching, so exact/stemmed word matching plus synonyms is what this MVP
provider offers; broad fuzzy matching is deliberately not attempted here
(rule #12: "do not make fuzzy matching so broad that irrelevant products
appear") — a real OpenSearch provider's fuzziness parameter is where
that would live.

## Filters and facets

`categoryId`, `minPrice`/`maxPrice`, `rating`, `availability` — all against
indexed, non-analyzed fields on `ProductSearchIndex` (rule #34/#135:
keyword/numeric fields for aggregation, not analyzed text). Facets
(`categories`, `ratings`, configurable `price` ranges) are computed from
the text-matched-but-not-yet-filtered set — a documented, common
approximation of rule #35's "facet counts should still behave predictably
when a filter is selected," rather than the more expensive
"recompute every facet excluding its own filter" approach a production
system might eventually need.

## Ranking (rule #40-41)

`rankingService.js#computeScore` — `textScore + popularity·0.15 +
rating·0.2 + freshness·0.1`, with an out-of-stock multiplier demoting
(not hiding) unavailable products (rule #105/#32). Deliberately small,
additive weights so relevance stays primary — rule #107's explicit "do not
make a 5-star product automatically outrank a highly relevant product" —
rating contributes a capped fraction, never multiplies the text score.
Weights live in one exported config object, tunable after real analytics
without touching control flow (rule #8: "tune after real search analytics,
do not assume these numbers are final").

## Merchandising — pin/boost/bury/redirect

`SearchRule` — admin-configured, query-scoped. **A real bug found and
fixed during testing**: pinning a product for a query originally only
reordered whatever the text search had already matched — if the pinned
product didn't organically match the query text (rule #44's own example is
essentially a promotional cross-sell, which by definition might not match),
`applyMerchandising` looked for it in the hit list, didn't find it, and
silently dropped the pin. Verified failure: pinning "Premium Almonds" for
the query "cashew" left "Roasted Cashews" (the organic top match)
unchanged in first place. Fixed by having `applyMerchandising` fetch any
missing pinned product directly from `ProductSearchIndex` and inject it,
rather than only reordering existing hits. Reverified: the pinned product
now correctly appears first. (Known remaining limitation: the response's
`total` count reflects organic matches only — an injected pin doesn't
increment it — documented as an accepted simplification, not silently
wrong.) Redirects (`action: "redirect"`) short-circuit the whole search
before any query execution — verified a `"giftbox" → /collections/gifts`
rule returns `{redirect: "/collections/gifts"}` immediately.

## Zero-result handling (rule #46-48)

Never a blank page: `didYouMean` (Levenshtein distance ≤2 against known
product-name tokens — `utils/levenshtein.js`, a small dependency-free
implementation used only for this, not for broadening the main query),
`popularProducts` fallback, `suggestedSearches` from recent top queries.
Verified: `"casheww"` (zero results) correctly suggested `"cashews"` and
returned a non-empty popular-products fallback.

## Autocomplete (rule #16-19)

A separate, cheap query path — anchored-prefix regex against `name`,
`distinct` category matches, and top-query search-term suggestions
filtered by prefix. Minimum 2-character query (rule #23). Compact
projection only (`productId`, `name`, `slug`, `price`, `category`,
`rating`) — never a full product fetch per suggestion.

## Analytics (rule #51-55, #113-114)

`SearchEvent` — `performed`/`no_results`/`clicked`/`add_to_cart`, tracked
with `sessionId`/`customerId` only (never email/phone/payment — rule
#117). `searchAnalyticsService.js` computes top queries, zero-result
queries, click-through rate, and zero-result rate for the admin dashboard
endpoint (`GET /admin/search/analytics`) — all aggregated from `SearchEvent`,
never recomputed by scanning every search-index document.

## Security / validation (rule #78-81, #119-120)

`pageSize` capped at 50 server-side regardless of what's requested (rule
#79); a `page` beyond 500 is rejected outright (`DEEP_PAGINATION_LIMIT`,
rule #81/#82 — cursor-based deep pagination isn't implemented, this is the
practical guard instead). Search and autocomplete both sit behind
dedicated rate limiters (60/min and 120/min respectively, per IP) —
looser than Phase 11/12's coupon/review limiters since normal shopping
behavior legitimately fires many autocomplete requests per session, but
still bounded against scraping (rule #120).

## Product visibility (rule #144)

Every provider query hard-filters `isActive: true, isPublished: true` —
archived/hidden products never appear in customer-facing search, verified
by archiving a product and confirming it drops out of search results
immediately (the synchronous re-index on archive, not a stale cache).

## What's explicitly NOT here yet (by design, not oversight)

- **A real OpenSearch/Elasticsearch cluster** — see Provider abstraction
  above; `opensearchProvider.js` documents the mapping/analyzer design
  (text vs keyword fields, edge n-grams, synonym token filters) that would
  be needed without implementing it against infrastructure that doesn't
  exist.
- **Event-driven/queued indexing** — direct synchronous calls today; no
  queue infrastructure exists in this project (same limitation as
  background jobs since Phase 5).
- **Index versioning/aliasing** (`products_v1`/`products_current`, rule
  #70/#71) — collapses to "clear and rebuild" for the Mongo provider,
  since Mongo has no alias concept; this is exactly where a real
  OpenSearch provider's zero-downtime reindex flow would differ.
- **Semantic/hybrid/vector search, personalization, A/B testing** (rule
  #94-98, #115) — explicitly deferred per the spec's own "do not make
  mandatory" language; the query-intent routing layer these would need
  doesn't exist, only lexical search does.
- **Multi-region/multi-currency/B2B-specific search** (rule #145/#146) —
  single currency (INR), single catalog, no B2B product visibility rules.
- **Search results page / admin merchandising & synonym management UI** —
  built minimally on the frontend (search bar, autocomplete, results page
  with filters/facets); a full admin dashboard for synonyms/rules/analytics
  wasn't built, consistent with the project's "admin UI is a later module"
  pattern from Phases 8-12 (the APIs are ready: `/admin/search/synonyms`,
  `/admin/search/rules`, `/admin/search/analytics`).
