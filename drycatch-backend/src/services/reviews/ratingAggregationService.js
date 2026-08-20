import Product from "../../models/Product.js";

function round1(n) {
  return Math.round(n * 10) / 10; // one documented, global rounding policy (rule #24)
}

// The only function that ever touches Product's rating aggregate fields —
// always via $inc deltas, never a blind overwrite or a full Review scan
// (rule #22/#74). Every caller (publish/unpublish/edit/delete a review)
// describes what CHANGED, not the new absolute state, so partial failures
// can't leave the aggregate silently wrong in a way a recompute would mask.
export async function applyRatingDelta(productId, { ratingDelta = 0, countDelta = 0, verifiedDelta = 0, photoDelta = 0, distributionDeltas = {} }) {
  const inc = {};
  if (ratingDelta) inc.ratingSum = ratingDelta;
  if (countDelta) inc.reviewsCount = countDelta;
  if (verifiedDelta) inc.verifiedReviewCount = verifiedDelta;
  if (photoDelta) inc.photoReviewCount = photoDelta;
  for (const [star, delta] of Object.entries(distributionDeltas)) {
    if (delta) inc[`ratingDistribution.${star}`] = delta;
  }
  if (!Object.keys(inc).length) return;

  const product = await Product.findByIdAndUpdate(productId, { $inc: inc }, { new: true });
  if (!product) return;

  // `rating` (the average) is a pure derivation of ratingSum/reviewsCount —
  // recomputed here from the just-updated counters (O(1), not a Review
  // scan) and written alongside them so both fields land in the same
  // document update.
  const average = product.reviewsCount > 0 ? round1(product.ratingSum / product.reviewsCount) : 0;
  if (average !== product.rating) {
    await Product.updateOne({ _id: productId }, { $set: { rating: average } });
  }

  // Phase 13 — rating/reviewCount are ranking signals in search
  // (rule #62/#107); keep the search projection's copy in sync rather than
  // letting it drift until the next full reindex.
  const { updateProductIndex } = await import("../search/indexingService.js");
  await updateProductIndex(productId).catch(() => {});
}

// Convenience wrappers used by reviewService for the four transitions that
// actually affect the public aggregate (rule #99: only PUBLISHED reviews
// count).
export async function onReviewPublished(review, hasPhoto) {
  await applyRatingDelta(review.product, {
    ratingDelta: review.rating,
    countDelta: 1,
    verifiedDelta: review.isVerifiedPurchase ? 1 : 0,
    photoDelta: hasPhoto ? 1 : 0,
    distributionDeltas: { [review.rating]: 1 },
  });
}

export async function onReviewUnpublished(review, hasPhoto) {
  await applyRatingDelta(review.product, {
    ratingDelta: -review.rating,
    countDelta: -1,
    verifiedDelta: review.isVerifiedPurchase ? -1 : 0,
    photoDelta: hasPhoto ? -1 : 0,
    distributionDeltas: { [review.rating]: -1 },
  });
}

// A published review's rating changed (edit) — rule #75: update both the
// old bucket and the new one, not just increment the new rating.
export async function onPublishedRatingChanged(review, oldRating) {
  if (oldRating === review.rating) return;
  await applyRatingDelta(review.product, {
    ratingDelta: review.rating - oldRating,
    distributionDeltas: { [oldRating]: -1, [review.rating]: 1 },
  });
}
