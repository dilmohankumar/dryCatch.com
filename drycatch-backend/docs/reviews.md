# Reviews & Ratings (Phase 12)

## The core rule

The backend is the sole authority on every fact a review carries:
verification, publication status, and the aggregate rating a product page
shows. Nothing here is ever trusted from the client — not `isVerifiedPurchase`,
not the aggregate, not moderation status.

## Before this phase

A pre-Phase-0 `Review` model already existed — real, but minimal: flat
`{product, user, rating, comment, helpfulCount, helpfulBy[]}`. No
verification, no moderation workflow, no media, no reports, no variant
awareness, no snapshotting. Its own code comment flagged the missing
unique constraint as a deliberate, punted business decision — this phase
makes that decision (see below) and builds the rest of the domain around
it.

## Review model

`Review` — `product`, `variant` (optional), `user`, `order` (set only by
`reviewEligibilityService`, never accepted from the client),
`isVerifiedPurchase`, `productNameSnapshot`/`variantNameSnapshot` (frozen at
creation — rule #26, a later product rename doesn't rewrite what the review
historically referenced), `rating` (integer 1-5, validated), `title`/`body`
(sanitized, length-capped), `status` (`pending`/`published`/`rejected`/
`hidden`/`deleted`), `publishedAt`, `moderatedBy`/`moderationReason`,
`helpfulCount`/`notHelpfulCount`, `featured` (admin-only).

## Policy decisions made explicit (not punted)

- **One review per product per customer** — `unique {product, user}` index.
  Editing is how an opinion changes; soft-deleting still leaves the document
  behind (`status: "deleted"`), so a customer cannot re-review after
  deleting either. A single race-safe DB constraint beats an app-level
  check-then-create with a race window, at the cost of "delete and start
  over" not being possible — an accepted tradeoff.
- **Purchase requirement** — `REVIEW_REQUIRE_PURCHASE` (env, default
  `"true"`): a customer must have a `paymentStatus: "succeeded"` order
  containing the product to review it at all. Set to `"false"` to allow any
  authenticated customer, with `isVerifiedPurchase` as a badge rather than a
  gate. Verified: reviewing without a qualifying order is rejected with
  `REVIEW_NOT_ELIGIBLE`.
- **Eligibility threshold is PAID, not DELIVERED** — rule #8 explicitly
  leaves this to business policy. Requiring full delivery would mean weeks
  before a review is possible on typical shipping timelines; payment
  success is already a strong verified-purchase signal.
- **Moderation mode** — `REVIEW_MODERATION_MODE` (env, `"auto"` default,
  `"manual"` alternative): `auto` publishes immediately (most small/medium
  stores' actual default); `manual` requires admin approval first
  (`reviewModerationService.initialStatus()`). A one-env-var switch, not a
  code fork.

## Rating aggregation — atomic deltas, never a full scan

`ratingAggregationService.js#applyRatingDelta` is the *only* place
`Product.rating`/`reviewsCount`/`ratingDistribution`/`verifiedReviewCount`/
`photoReviewCount` are ever touched — always via `$inc` deltas describing
what changed, never a blind overwrite or a scan of every `Review` for that
product (rule #22/#74). `Product.ratingSum` is the running total that makes
the average an O(1) division (`ratingSum / reviewsCount`, rounded to one
decimal — the one documented global rounding policy, rule #24) rather than
a re-aggregation on every read.

Four transitions call it: `onReviewPublished`, `onReviewUnpublished`
(hide/reject/delete a previously-published review), and
`onPublishedRatingChanged` (editing a *published* review's rating moves
both the old distribution bucket down and the new one up — rule #75, never
just incrementing the new rating and leaving the old bucket wrong).
**Only `published` reviews ever affect the aggregate** (rule #99) —
verified: hiding a published review correctly zeroed `reviewsCount` back to
0; restoring it brought the count and rating back exactly.

## Moderation

`reviewModerationService.js#moderate(reviewId, action, adminId, reason)` —
the only path any status transition takes, so the rating-aggregate side
effect can never be forgotten by a controller doing `review.status = X`
directly. Explicit transition graph (`pending→published|rejected`,
`published→hidden`, `rejected|hidden→published`) — `deleted` is terminal,
reachable only via the customer's own soft-delete, never an admin
transition target.

## Verified purchase

`reviewEligibilityService.js#checkEligibility` is the only place
`isVerifiedPurchase` is ever set — it looks up the customer's own paid
orders (`paymentStatus: "succeeded"`) containing the product/variant being
reviewed, exactly as Phase 9 established order data. The client sends
`rating`/`title`/`body`/`variantId`/`media` and nothing else; there is no
field for a client to inject `isVerifiedPurchase` into.

## Content sanitization

`utils/sanitizeText.js#sanitizePlainText` strips all HTML tags and
`javascript:` URIs from `title`/`body` before they're ever saved — reviews
are rendered as plain text everywhere in this project, so stripping
markup entirely is the correct defense (rule #6/#50), not an allow-list of
"safe" HTML that doesn't exist here. Verified: a submitted
`<script>alert(1)</script>` title and `<img src=x onerror=alert(1)>` body
were both saved with every tag removed.

## Helpful votes

`ReviewVote` — unique `{review, user}` index; `reviewVoteService.js#castVote`
upserts (changing Helpful→Not Helpful updates the existing document, never
creates a second one) and keeps `Review.helpfulCount`/`notHelpfulCount` in
sync via `$inc` deltas, not a recount. Voting the same way twice is a
no-op (idempotent). **Self-voting is blocked** — `REVIEW_NOT_OWNER` —
verified. Verified the full lifecycle: first vote → switch → remove all
left exactly the right counts.

## Reporting

`ReviewReport` — unique `{review, user}` index prevents the same customer
reporting the same review twice while it's still active (rule #36).
Reasons: `spam`/`offensive`/`fake_review`/`irrelevant`/`abusive`/`other`.
Status: `open→under_review→{resolved, dismissed}`.

## Media

`ReviewMedia` — real model, real limits (5 images / 1 video per review,
MIME allow-list, size caps), but **no object storage is integrated
anywhere in this project** (same honest-stub pattern as Phase 8's Stripe
adapter and Phase 10's Shiprocket adapter) — `url`/`storageKey` are
supplied by the caller rather than generated by an actual presigned-upload
flow to S3/Cloudinary/etc. The seam (`reviewService.createReview`'s
`media` parameter, validated by `validateMediaBatch`) is exactly where a
real upload integration would slot in later without changing the calling
code. Content-type/size validation here is real for what's declared, but
can't validate actual file *bytes* without a real storage backend —
documented as the honest boundary of what's enforceable today.

## Sorting, filtering, pagination

`reviewService.js#getProductReviews` — `sort` (`newest`/`highest_rating`/
`lowest_rating`/`most_helpful`), `rating` filter, `verifiedOnly`,
`hasPhotos` (resolved via a batched `ReviewMedia.distinct` query, not
per-review lookups), always paginated (never every review for a popular
product in one response — rule #46). Media for the returned page is
fetched in one batched query and grouped in memory, not N+1 per review.

## Rate limiting

Review creation: 20/15min per IP. Review edit/vote/report: 60/15min per
IP — separate, tighter limiters than the blanket API limiter, same
pattern as Phase 11's coupon limiter (rule #89/#90 — reviews are a spam
target).

## What's explicitly NOT here yet (by design, not oversight)

- **Real object storage / presigned uploads** — see Media above.
- **Automatic post-delivery review request emails** (rule #52-56) — no
  background job scheduler exists in this project (same limitation noted
  since Phase 5's inventory-reservation expiry); the data model doesn't
  need a `ReviewRequest` collection built out until that infrastructure
  exists.
- **AI moderation / profanity detection / spam scoring** (rule #51/#65) —
  the moderation pipeline (`reviewModerationService`) is structured so
  these could plug in as an additional check before `initialStatus()`
  returns, but none is implemented; rule-based-only for now, and negative
  reviews are never auto-rejected simply for being negative (rule #66).
- **Merchant/admin public responses to reviews** (rule #67/#68) — future
  `ReviewResponse` model, not built.
- **Full-text review search / Elasticsearch** (rule #29/#78) — sorting and
  rating/verified/photo filters exist; free-text search across review
  bodies does not.
- **Admin analytics dashboard** (rule #69/#111) — the aggregate data
  (`Product.rating`, `reviewsCount`, `ratingDistribution`,
  `verifiedReviewCount`, `photoReviewCount`) and the paginated admin
  `GET /admin/reviews`/`GET /admin/review-reports` endpoints are the raw
  material a dashboard would read; no dashboard UI was built, matching the
  project's consistent "admin UI is a later module" pattern from Phases
  8-11.
