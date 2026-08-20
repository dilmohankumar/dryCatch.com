import Review from "../../models/Review.js";
import ReviewMedia from "../../models/ReviewMedia.js";
import { onReviewPublished, onReviewUnpublished } from "./ratingAggregationService.js";
import { logAuditEvent } from "../../utils/auditLog.js";
import * as eventBus from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// REVIEW_MODERATION_MODE (env, "auto" | "manual", default "auto") — rule
// #14's explicit "do not hard-code one workflow" configuration knob.
// AUTO_PUBLISH is the default because it's what most small/medium stores
// actually run; MODERATION_REQUIRED is a one-env-var switch, not a code
// change.
export function initialStatus() {
  return process.env.REVIEW_MODERATION_MODE === "manual" ? "pending" : "published";
}

const VALID_TRANSITIONS = {
  pending: ["published", "rejected"],
  published: ["hidden"],
  rejected: ["published"], // admin can reconsider
  hidden: ["published"],
  deleted: [],
};

async function hasPhoto(reviewId) {
  return (await ReviewMedia.countDocuments({ review: reviewId, type: "image", status: "ready" })) > 0;
}

// Admin moderation action — approve/reject/hide/restore, all funneled
// through one function so the rating-aggregate side effect (rule #99: only
// PUBLISHED reviews count) can never be forgotten by a controller calling
// `review.status = X` directly.
export async function moderate(reviewId, action, adminId, reason) {
  const review = await Review.findById(reviewId);
  if (!review) fail("Review not found", "REVIEW_NOT_FOUND", 404);

  const toStatus = { approve: "published", reject: "rejected", hide: "hidden", restore: "published" }[action];
  if (!toStatus) fail("Unknown moderation action", "INVALID_ACTION");
  if (!(VALID_TRANSITIONS[review.status] || []).includes(toStatus)) {
    fail(`Cannot move a review from "${review.status}" to "${toStatus}"`, "REVIEW_NOT_EDITABLE", 409);
  }

  const wasPublished = review.status === "published";
  const willBePublished = toStatus === "published";
  const photo = await hasPhoto(review._id);

  review.status = toStatus;
  review.moderatedBy = adminId;
  review.moderationReason = reason;
  if (willBePublished && !review.publishedAt) review.publishedAt = new Date();
  await review.save();

  if (!wasPublished && willBePublished) await onReviewPublished(review, photo);
  else if (wasPublished && !willBePublished) await onReviewUnpublished(review, photo);

  if (action === "approve") {
    await eventBus.publish(EVENT_TYPES.REVIEW_APPROVED, { userId: String(review.user), entityId: String(review._id) }, { source: "review" });
  } else if (action === "reject") {
    await eventBus.publish(EVENT_TYPES.REVIEW_REJECTED, { userId: String(review.user), entityId: String(review._id) }, { source: "review" });
  }

  logAuditEvent("REVIEW_MODERATED", adminId, { reviewId: String(review._id), action, toStatus, reason });
  return review;
}

export { fail };
