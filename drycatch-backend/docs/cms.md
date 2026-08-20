# Headless CMS (Phase 15)

## The core rule

CMS manages **content**. Commerce modules manage **commerce**. A CMS
`productGrid` block never stores a product's name/price/stock — it stores
`productIds`/`categoryId`/`collectionId` and the public content API
resolves those references against live `Product`/`Category`/`Collection`
data on every read (rule #20/#139/#140). If a price changes in the
Catalog, every page referencing that product reflects it immediately —
CMS never becomes a second, staler source of truth for anything
commerce-owned.

## Before this phase

No CMS existed — the homepage and every static page (`/about`, `/contact`,
etc.) were hard-coded React components. This phase adds a real, block-based
headless CMS without touching how Catalog/Orders/Payments/etc. work.

## Content model — unified, not triplicated

Rule #4/#7 lists `Page`, `LandingPage`, and the homepage as separate CMS
modules — but they're the same underlying entity (title, slug, blocks,
SEO, lifecycle), differing only in `pageType`
(`static`/`landing`/`homepage`). One `Page` model, not three near-identical
schemas that would otherwise triplicate the lifecycle/revision/block
machinery. The homepage is simply the one `Page` with `pageType:
"homepage"` — a singleton by convention (`pageService.getOrCreateHomepage`
lazily creates it), not a unique index, since a future multi-store CMS
would need more than one.

`BlogPost` is a genuinely separate model — different fields (excerpt,
category, tags, featuredImage) and different listing/filtering shape — but
shares the exact same lifecycle enum and the same `ContentRevision` model
(`contentType: "blog"`) rather than a duplicate `BlogRevision` collection.

## Blocks — structured, validated, never a raw HTML blob

`services/cms/blockRegistry.js` — the centralized catalog (rule #18/#19):
`hero, richText, image, imageText, productGrid, categoryGrid,
collectionGrid, banner, faq, testimonials, newsletter, cta, blogGrid,
reviewSummary, spacer`. Every block is validated against its type's
required/allowed fields before save — missing required fields are
rejected (`INVALID_BLOCK`), and **unknown fields are silently stripped**,
never persisted (rule #17). Verified: an unrecognized block type is
rejected outright; a `hero` block missing its required `image` field is
rejected; a `spacer` block with an injected extra field had that field
silently dropped from the saved document.

## Content lifecycle

`utils/contentStateMachine.js` — explicit graph (`draft → in_review →
approved → scheduled → published → archived`, with `archived → draft` for
restoring), same pattern as Phase 9's `orderStateMachine.js`. Nothing sets
`status` directly outside `pageService.js`/`blogService.js`'s transition
functions. Verified: `draft → scheduled` (skipping review/approval) is
correctly invalid; `draft → published` (direct publish, for a role with
publish permission who skips review) is valid; `published → draft`
(bypassing archive) is correctly invalid.

**A published page can never be edited directly** — `updatePage`/
`updateBlogPost` reject with `PAGE_NOT_EDITABLE`/`BLOG_NOT_EDITABLE` once
status is `published` or `archived`. Verified. (This is the project's
chosen answer to rule #77's "draft locking" — rather than a two-editor
optimistic-lock/version-check system, the real protection is that live
content simply isn't mutable in place at all; an edit always means
`send-back-to-draft` first, which is itself an explicit, audited
transition.)

## Publish validation — broken references caught before going live

`services/cms/publishValidationService.js` — before any `publish`
transition, every block's commerce references are checked against live
data: a `productGrid` block's `productIds`/`categoryId`/`collectionId`
must exist and be active; a `banner` block's `bannerId` must exist; a
`faq` block's `faqIds` must be active; a `hero`/`image` block's `image`
must be a `ready` `MediaAsset`. Verified: publishing a page succeeded while
its referenced product was active, then — after archiving that product —
a **new** page referencing the same (now-archived) product was correctly
blocked from publishing (`PUBLISH_VALIDATION_FAILED`,
`BROKEN_PRODUCT_REFERENCE`), returning every issue found, not just the
first.

## Revisions — append-only, restore creates a new revision

One generic `ContentRevision` model (`contentType: "page"|"blog"`) for both
content types (rule #72), not a separate `PageRevision`/`BlogRevision`
pair. Every meaningful save (`create`, `update`) records a full snapshot.
Restoring a revision (rule #74) **creates a new revision** and sends the
content back to `draft` — it never republishes directly and never deletes
the revisions in between. Verified: archiving a published page, then
restoring its v1 revision, correctly returned it to `draft` status while
all prior revisions (now 2: v1 original, v2 the restore) remained intact.

## Redirects — loop and duplicate detection

`services/cms/redirectService.js#createRedirect` walks the existing
redirect chain (up to 20 hops) before accepting a new one — rejects a
redirect pointing at itself, a direct A↔B loop, and a duplicate source
path. Verified: creating `/a → /b` then attempting `/b → /a` was correctly
rejected (`REDIRECT_LOOP`); `/self → /self` was rejected; a second
redirect for an already-used source path was rejected
(`REDIRECT_SOURCE_TAKEN`).

## Media — real validation, honest gap on real storage

`MediaAsset` + `mediaService.js` — same honest-stub shape as Phase 12's
`ReviewMedia`: real MIME allow-list and size-limit enforcement (verified:
an `.exe` disguised as an image and an oversized image were both
rejected), but no actual object-storage/CDN integration exists anywhere in
this project — `url`/`storageKey` are supplied by the caller. SVG is
deliberately excluded from the image allow-list (rule #47/#54 — SVG XSS
risk, no sanitizer for it exists here).

**Usage tracking protects referenced media from deletion** (rule #109) —
verified: a `MediaAsset` referenced by a page's `hero` block could not be
deleted (`MEDIA_IN_USE`) until the reference was removed. Orphan detection
(`listOrphanedMedia`, rule #110) scans the same reference set in reverse.

## Banners — schedule enforced at read time

Same lazy-check pattern as Cart/Checkout expiry elsewhere in this
project — no background scheduler flips a banner's status automatically;
`bannerService.getActiveBanners` filters by `startDate`/`endDate` against
`now()` on every call. Verified: an expired banner (end date 10 days ago)
was correctly excluded from the active set while a currently-active one
was included. Impression/click counters are server-side (`$inc`), never
trusted from frontend UI state.

## RBAC — publish is a separate permission from edit

Rule #71's core requirement, honored directly: `cms.pages.update` and
`cms.pages.publish` (same for `cms.blog.*`) are distinct permission
strings. Three new default roles: `CONTENT_WRITER` (create/edit, no
publish), `CONTENT_EDITOR` (full CMS access including publish),
`SEO_MANAGER` (scoped narrowly to `cms.seo.update`/`cms.redirects.manage`
— can't touch page content at all). Global SEO defaults
(`SEOSettings`) require `cms.seo.update` specifically, separate from
ordinary content editing, so a content editor can't accidentally set the
whole site to `noindex` while editing one page (rule #58/#126).

## Public content API — batched, published-only, N+1-free

`services/cms/contentApiService.js` — the storefront calls **one**
endpoint per page (`GET /content/pages/:slug`) and gets back blocks whose
commerce references are already resolved to live data, via a handful of
**batched** queries (one `Product.find({_id: {$in: [...]}})` for every
manually-selected product across every block on the page, not one query
per block per product — rule #151). Verified: fetching a published page
with a `productGrid` block returned fully-populated product data in the
response. Every function in this file enforces `status: "published"` —
verified fetching a still-draft page by slug correctly 404s
(`PAGE_NOT_FOUND`), never leaking draft content through the public API
(rule #82).

## What's explicitly NOT here yet (by design, not oversight)

- **Real scheduled publishing** — `processScheduledPages`/
  `processScheduledPosts` exist and correctly flip `scheduled → published`
  when due, but nothing calls them on a timer; exposed as an admin-
  triggered `POST /admin/cms/pages/run-scheduler` endpoint instead. No job
  scheduler exists in this project (same limitation noted since Phase 5's
  inventory-reservation expiry).
- **Real object storage / CDN / image optimization pipeline** — see Media
  above.
- **Multi-tenant/multi-store CMS, localization** (rule #86-90) — single
  store, single language; every model lacks a `tenantId`/`locale` field,
  consistent with Phase 14's same documented multi-tenant gap.
- **Live/real-time preview, signed preview tokens** (rule #63-65) — not
  built this phase; an authenticated admin can view a draft via the
  regular admin `GET /admin/cms/pages/:id` endpoint, but there's no public,
  token-based unauthenticated preview link yet.
- **Drag-and-drop page builder** — deliberately not attempted (rule #101
  explicitly says start with ordered structured blocks; a visual builder
  is future work).
- **Reusable/shared content-block library** — blocks are inline per-page
  only; a separate "save this Hero as reusable" library wasn't built.
- **Content analytics beyond banner impressions/clicks** (rule #92) — page
  views, CTA click-through, landing-page conversion tracking aren't wired
  up; would need the same analytics-event infrastructure Phase 13's search
  analytics uses, extended to CMS events.
- **Content health score, stale-content alerts, sitemap generation** (rule
  #60/#170-172) — not built; the underlying data (published/draft counts,
  `updatedAt`) is all there for a future dashboard widget to compute from.
