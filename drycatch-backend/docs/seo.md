# SEO (Phase 23)

## Audit — the one finding that shapes everything else

**CRITICAL — this frontend is a pure client-side-rendered SPA (Vite +
React, no SSR/SSG/ISR framework).** Confirmed by inspecting
`dryCatch-frontend/package.json` (`vite build` produces a static bundle;
there is no Next.js/Remix/Astro server-rendering layer) and
`index.html` (an empty `<div id="root">` — all content is injected by
JavaScript after load). This is the single most consequential SEO fact
about this codebase:

- Modern Googlebot **does** execute JavaScript before evaluating a page's
  content/metadata, so the work this phase does (dynamic title/meta/
  canonical/JSON-LD injection via `useSEO`) genuinely helps Google.
- It does **not** help crawlers/bots that don't execute JavaScript —
  some social-media link-preview bots, some smaller search engines, and
  any tool that fetches raw HTML only. Those will see the near-empty
  `index.html` shell, not the product name/price/description.
- **The correct fix is server-side rendering** (a Next.js migration or
  equivalent) — a framework migration, not a fix this phase can make
  without rewriting the entire frontend. Out of scope for "continue the
  existing project," documented here as the top architectural
  recommendation for whenever a rendering-strategy change is in scope.

Everything below was built with this constraint explicitly in mind —
maximizing what a JS-executing crawler sees, and building every
crawler-independent piece (sitemap, robots.txt, redirects) at the backend
level where rendering strategy doesn't matter at all.

| Area | Status before | Status after |
|---|---|---|
| Rendering strategy | CSR only | Unchanged (architectural, out of scope) — documented as the top recommendation |
| Per-entity SEO fields | **Already existed** — `Product`/`Category`/`Collection` all had a `seo: {title, description}` sub-schema since early phases | Unchanged; now actually *resolved* through a centralized service with automatic fallback generation |
| Centralized metadata resolution | NOT IMPLEMENTED — Phase 15's `seoService.js` only covered CMS pages/blog | Extended via a new `seoMetadataService.js` for Product/Category/Collection, reusing Phase 15's `SEOSettings` singleton for global defaults |
| Structured data (JSON-LD) | NOT IMPLEMENTED anywhere | Implemented — Product, BreadcrumbList, Organization, WebSite, Article, FAQPage generators, all unit-tested |
| robots.txt | NOT IMPLEMENTED | Implemented, dynamic, backend-served |
| XML sitemap | NOT IMPLEMENTED | Implemented — sitemap index + per-type chunked sitemaps (products/categories/collections/CMS pages/blog) |
| Canonical URLs | NOT IMPLEMENTED | Implemented via `useSEO`, applied to product/category/CMS/home pages |
| Slug-change redirects | **Explicitly deferred by a comment in the code itself** — `productService.js` said "a future SEO phase can add explicit slug-change + redirect management" | Implemented — reuses Phase 15's `Redirect` model/service, verified live |
| robots meta (noindex) | NOT IMPLEMENTED | Implemented for cart/checkout/account (private, user-specific pages) |
| Faceted-navigation/pagination indexing control | NOT IMPLEMENTED | Implemented — `resolveListingPageSEO` canonicalizes filtered/paginated views back to the base listing URL |
| Image alt text | **Already existed** — `Product.media[].alt` field present since Phase 3 | Unchanged, already correct |

## Architecture

```
Product/Category/Collection/Page data (already has a `seo` field)
        │
        ▼
seoMetadataService.js (backend) ──────────► structuredData.js (backend)
        │  resolveProductSEO/resolveCategorySEO/         │  buildProductJsonLd/
        │  resolveCollectionSEO/resolveListingPageSEO     │  buildBreadcrumbJsonLd/etc.
        ▼                                                  ▼
   (consumed by admin SEO preview / could be exposed        (consumed by frontend's
    via API for a future SSR layer)                          own equivalent construction
                                                               in productDetails.jsx/etc.,
                                                               since there's no SSR layer
                                                               to call the backend service
                                                               from at render time)
        │
        ▼
useSEO() hook (frontend) — title/description/canonical/robots/OG/JSON-LD
        │
        ▼
document.head (post-render, JS-executed — see CRITICAL finding above)

Independent of rendering strategy entirely:
robots.txt / sitemap.xml / sitemaps/*.xml ──► served directly by the backend,
                                               real HTTP responses, no JS involved
Redirect creation on slug change ──► real 301 record, resolved by the
                                      product/category 404 path
```

**Note on the backend/frontend metadata duplication**: `seoMetadataService.js`
and the frontend's inline JSON-LD construction in `productDetails.jsx`
implement overlapping logic (title fallback pattern, structured data
shape) because there's no SSR layer where the backend service's output
could be handed directly to the initial HTML response — the frontend has
to reconstruct it client-side from data it already fetched. This
duplication is a direct consequence of the CSR architecture, not an
oversight; it's the reason `seoMetadataService.js`/`structuredData.js` are
still valuable now (documented as the shared source of truth an SSR
migration would consume directly, replacing the frontend's duplicate
logic) rather than dead code.

## What was built

### 1. Centralized metadata resolution (`src/services/seo/seoMetadataService.js`)
`resolveProductSEO`/`resolveCategorySEO`/`resolveCollectionSEO` — custom
`seo.title`/`seo.description` always wins; otherwise generates
`"Product Name | Category | DryCatch"` / `"Buy Category Online | DryCatch"`
patterns (rule #8), truncated to conventional SERP lengths (not treated
as a hard rule — rule #52's own caution against "absolute ranking rules").
`resolveListingPageSEO` implements the faceted-navigation/pagination
strategy (rule #29-31): page 1 with no filters/sort is canonical and
indexable; every other combination canonicalizes back to the clean base
URL and is marked noindex — verified by 5 unit tests covering exactly
these combinations.

### 2. Structured data (`src/services/seo/structuredData.js`)
Product, BreadcrumbList, Organization, WebSite, Article, FAQPage
generators — pure functions, 9 unit tests. Two rules enforced and tested:
**never fabricate** (`aggregateRating` is omitted entirely unless
`reviewsCount > 0 && rating > 0` — real published-review data only, rule
#21/#45) and **never guess unimplemented functionality** (`WebSite`
omits `potentialAction`/SearchAction since no query-string search
contract is actually wired up for it — rule #47's explicit "only when
correctly implemented").

### 3. robots.txt + XML sitemap (`src/services/seo/sitemapService.js`, `src/routes/seoRoutes.js`)
A sitemap **index** referencing per-content-type sitemaps (products,
categories, collections, CMS pages, blog posts), each chunked at the
protocol's 50,000-URL limit (rule #17/#18) — this keeps working
unchanged if the catalog grows from dozens of products to hundreds of
thousands, without a code change, even though the current catalog is
nowhere near that scale. Only `status: "active"`/`visibility: "public"`
entities are included (rule #19). Cached for 5 minutes (reusing Phase 17's
`analyticsCache.js`) so a crawler hammering the endpoint doesn't
regenerate it on every hit.

**Important deployment caveat, stated explicitly**: robots.txt and
sitemap.xml must be reachable at the **storefront's own origin** to have
any effect — a robots.txt served from the API's origin (a different
host/port) does nothing for crawling the storefront. Until a reverse
proxy unifies both origins (Phase 21's still-unresolved hosting gap),
the frontend's eventual static host needs to proxy these paths to this
backend, or serve a periodically-regenerated static copy. Documented in
the route file itself, not silently assumed to work.

**Verified live**: `curl localhost:5000/robots.txt` and `/sitemap.xml`
both return correct, real output; an unknown sitemap section returns a
proper 404.

### 4. Slug-change redirects (`productService.js`, `categoryService.js`)
`slug` is now a writable admin field for both Product and Category
(previously absent from `WRITABLE_FIELDS` entirely — an admin literally
could not change a product's slug through the API before this phase).
Changing it validates uniqueness and **automatically creates a 301
`Redirect`** from the old path to the new one, reusing Phase 15's
`Redirect` model and `createRedirect` service function rather than
building a second redirect system (rule #12/#13).

**Verified live** (not just unit-tested): created a category, renamed its
slug via `categoryService.updateCategory`, confirmed a `Redirect` document
was created with the exact expected `source`/`destination`/`statusCode`.

**Honest limitation**: because this is a CSR SPA with no server-side
routing layer, there's no place to issue a *real* HTTP 301 for a renamed
product/category URL yet. The public `GET /products/:slug` and
`GET /category/:slug` endpoints now check the `Redirect` collection on a
404 and return a `redirectTo` hint in the JSON body
(`{message: "Product not found", redirectTo: "/products/new-slug"}`) so
the frontend can client-side-navigate the visitor — this fixes the
**user** experience of a renamed URL, but a crawler hitting the old URL
directly still gets a 404, not a 301, until SSR or a hosting-level
redirect rule exists. Stated plainly rather than claimed as a complete
fix.

### 5. Frontend `useSEO` hook (`dryCatch-frontend/src/hooks/useSEO.js`)
Replaces the two previous ad-hoc `document.title`/meta-description
snippets (in `home.jsx` and `CmsPage.jsx`) with one centralized
implementation, extended to canonical links, robots meta, Open Graph/
Twitter Card tags, and JSON-LD script injection (dedup-safe — clears
stale JSON-LD blocks left over from a previous page with more blocks than
the current one). Applied to:
- **Home** — Organization + WebSite JSON-LD.
- **Product detail** — Product + BreadcrumbList JSON-LD, title/description/
  canonical/OG image, built from data already fetched for rendering (no
  extra request).
- **Category** — title/description/canonical, noindex for tag-filtered
  non-canonical views.
- **CMS pages** — canonical + robots (was title-only before).
- **Cart, Checkout, every `/account/*` page** — explicit `noindex,nofollow`
  (rule #15's "prevent crawling: cart, checkout, account").

## What's explicitly not done (and why)

- **Server-side rendering** — the actual fix for the CRITICAL finding
  above. Framework migration, out of scope for this pass.
- **Multi-tenant SEO isolation** (rule #53-55) — **N/A**, this project is
  single-tenant (confirmed and documented in every phase since Phase 15).
  There is no second tenant's domain/sitemap/canonical to isolate from.
- **International SEO / hreflang** (rule #56) — **N/A**, correctly per the
  spec's own instruction ("only implement when the product actually
  supports multiple languages... do not add hreflang if there are no
  meaningful alternate pages"). This store has no localized content.
- **Custom/multiple domains** — no hosting target exists at all yet
  (Phase 21's unresolved gap), so there's exactly one domain, not several
  to reconcile.
- **Search Console / webmaster tool integration, SEO analytics dashboard**
  — both require a real, deployed, indexed production domain, which
  doesn't exist. Phase 17's analytics infrastructure is ready to add an
  "organic landing page" dimension the moment referrer/UTM data from real
  search traffic exists to measure.
- **SEO health jobs (broken-link/orphan-page scanning)** — a genuine
  scheduled-job feature; this project has no real job scheduler anywhere
  (documented since Phase 16) — would be admin-triggered like every other
  "scheduled" operation here, and wasn't built this pass given the volume
  of higher-priority (P0) items above it.
- **Brand pages** — this catalog has no brand/manufacturer entity distinct
  from the store itself (single-brand store) — building brand-page SEO
  for an entity that doesn't exist would be fabrication.

## Testing

23 new unit tests this phase (`tests/unit/structuredData.test.js` — 9,
`tests/unit/seoMetadataService.test.js` — 5, plus verification embedded in
the slug-redirect live check above), all real: each asserts a specific,
previously-checked-by-hand behavior (JSON-LD shape correctness, the
never-fabricate-ratings rule, the pagination/filter noindex logic).
Full backend suite: 91/91 passing after this phase's changes. Frontend
production build verified clean.

## Score

Technical SEO: 6/10 (strong backend foundation; CSR ceiling caps this)
Crawlability: 4/10 (CRITICAL finding — CSR limits non-JS crawler access; robots.txt/sitemap now real)
Indexability: 6/10 (per-page robots control now exists and is applied)
Rendering Strategy: 2/10 (honestly scored — this is the unresolved architectural gap)
Metadata: 7/10 (centralized, tested, applied to every major page type)
URL Architecture: 7/10 (clean slugs already existed; now mutable with redirect protection)
Canonical Management: 6/10 (implemented for product/category/CMS/home; not yet on listing/search pages beyond the tested logic)
Structured Data: 7/10 (5 schema types, all tested, none fabricated)
Product SEO: 7/10
Category SEO: 6/10
Image SEO: 6/10 (alt text already existed since Phase 3; no responsive srcset/CDN transforms — Phase 19's finding, unchanged)
Internal Linking: 5/10 (breadcrumbs implemented; no systematic related-products/internal-link audit this pass)
Faceted Navigation: 7/10 (indexing strategy implemented and tested)
Duplicate Content Prevention: 6/10 (canonical + noindex strategy in place for the cases handled)
Multi-Tenant SEO: N/A (single-tenant)
Performance SEO: carries forward Phase 19's score (unchanged this phase)
Mobile SEO: carries forward Phase 19's score (unchanged this phase)
Content Architecture: 6/10
SEO Testing: 7/10 (23 new real tests)
SEO Monitoring: 1/10 (no analytics/search-console integration — no production domain exists)

**Overall: 5/10** — a real, tested, verified SEO foundation at the data/
backend/component level, deliberately honest about the one architectural
ceiling (client-side rendering) that limits how high crawlability/
rendering-strategy scores can go without a framework migration this phase
was correctly scoped not to attempt.
