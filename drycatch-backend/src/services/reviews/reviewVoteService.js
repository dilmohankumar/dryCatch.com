import Review from "../../models/Review.js";
import ReviewVote from "../../models/ReviewVote.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// POST /reviews/:id/vote — { vote: "helpful" | "not_helpful" }. Upserts
// (rule #32: changing a vote updates the existing document, never creates
// a second one) via the unique {review, user} index, and keeps
// Review.helpfulCount/notHelpfulCount in sync via a delta, not a recount.
export async function castVote(reviewId, userId, voteValue) {
  if (!["helpful", "not_helpful"].includes(voteValue)) fail("Invalid vote value", "INVALID_VOTE", 400);

  const review = await Review.findById(reviewId);
  if (!review) fail("Review not found", "REVIEW_NOT_FOUND", 404);
  if (review.status !== "published") fail("This review is not available", "REVIEW_NOT_PUBLISHED", 409);
  if (String(review.user) === String(userId)) fail("You can't vote on your own review", "REVIEW_NOT_OWNER", 403);

  const existing = await ReviewVote.findOne({ review: reviewId, user: userId });
  if (existing && existing.vote === voteValue) return review; // idempotent — voting the same way twice is a no-op

  const inc = {};
  if (existing) {
    // Switching vote — decrement the old bucket, increment the new one.
    inc[existing.vote === "helpful" ? "helpfulCount" : "notHelpfulCount"] = -1;
    existing.vote = voteValue;
    await existing.save();
  } else {
    await ReviewVote.create({ review: reviewId, user: userId, vote: voteValue });
  }
  inc[voteValue === "helpful" ? "helpfulCount" : "notHelpfulCount"] = (inc[voteValue === "helpful" ? "helpfulCount" : "notHelpfulCount"] || 0) + 1;

  return Review.findByIdAndUpdate(reviewId, { $inc: inc }, { new: true });
}

export async function removeVote(reviewId, userId) {
  const existing = await ReviewVote.findOneAndDelete({ review: reviewId, user: userId });
  if (!existing) return Review.findById(reviewId);
  const field = existing.vote === "helpful" ? "helpfulCount" : "notHelpfulCount";
  return Review.findByIdAndUpdate(reviewId, { $inc: { [field]: -1 } }, { new: true });
}

export { fail };
