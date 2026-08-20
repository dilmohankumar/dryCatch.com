import Review from "../../models/Review.js";
import ReviewMedia from "../../models/ReviewMedia.js";
import ReviewVote from "../../models/ReviewVote.js";
import Product from "../../models/Product.js";
import ProductVariant from "../../models/ProductVariant.js";
import { checkEligibility } from "./reviewEligibilityService.js";
import { initialStatus, moderate } from "./reviewModerationService.js";
import { onReviewPublished, onReviewUnpublished, onPublishedRatingChanged } from "./ratingAggregationService.js";
import { sanitizePlainText } from "../../utils/sanitizeText.js";
import { logAuditEvent } from "../../utils/auditLog.js";
import * as eventBus from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function assertValidRating(rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fail("Rating must be a whole number from 1 to 5", "INVALID_RATING", 400);
  }
}

function validateMediaBatch(media = []) {
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  if (images.length > MAX_IMAGES) fail(`Maximum ${MAX_IMAGES} images per review`, "MEDIA_LIMIT_EXCEEDED", 400);
  if (videos.length > MAX_VIDEOS) fail(`Maximum ${MAX_VIDEOS} video per review`, "MEDIA_LIMIT_EXCEEDED", 400);
  for (const m of media) {
    if (m.type === "image" && !ALLOWED_IMAGE_MIME.includes(m.mimeType)) fail("Unsupported image type", "MEDIA_INVALID", 400);
    if (m.type === "video" && !ALLOWED_VIDEO_MIME.includes(m.mimeType)) fail("Unsupported video type", "MEDIA_INVALID", 400);
    if (m.type === "image" && m.size > MAX_IMAGE_BYTES) fail("Image exceeds the size limit", "MEDIA_INVALID", 400);
    if (m.type === "video" && m.size > MAX_VIDEO_BYTES) fail("Video exceeds the size limit", "MEDIA_INVALID", 400);
    // Extension/Content-Type from the client is never trusted alone — real
    // validation of file *contents* would happen at the object-storage
    // upload step (rule #17), which doesn't exist in this project yet (see
    // ReviewMedia.js's comment). This is the honest boundary of what's
    // enforceable without that integration.
  }
}

// POST /products/:productId/reviews — { rating, title, body, variantId?, media? }
export async function createReview(userId, productId, { rating, title, body, variantId, media }) {
  assertValidRating(rating);
  validateMediaBatch(media);

  const product = await Product.findOne({ _id: productId, status: "active" });
  if (!product) fail("Product not found", "REVIEW_NOT_ELIGIBLE", 404);

  const variant = variantId ? await ProductVariant.findOne({ _id: variantId, product: productId }) : null;
  if (variantId && !variant) fail("Variant does not belong to this product", "REVIEW_NOT_ELIGIBLE", 400);

  const eligibility = await checkEligibility(userId, productId, variantId);
  if (!eligibility.eligible) fail("You can only review products you've purchased", "REVIEW_NOT_ELIGIBLE", 403);

  const existing = await Review.findOne({ product: productId, user: userId });
  if (existing) fail("You've already reviewed this product — edit your existing review instead", "ALREADY_REVIEWED", 409);

  const status = initialStatus();
  let review;
  try {
    review = await Review.create({
      product: productId,
      variant: variantId || undefined,
      user: userId,
      order: eligibility.order?._id,
      isVerifiedPurchase: eligibility.isVerifiedPurchase,
      productNameSnapshot: product.name,
      variantNameSnapshot: variant?.weight?.value ? `${variant.weight.value}${variant.weight.unit}` : undefined,
      rating,
      title: sanitizePlainText(title),
      body: sanitizePlainText(body),
      status,
      publishedAt: status === "published" ? new Date() : undefined,
    });
  } catch (err) {
    if (err.code === 11000) fail("You've already reviewed this product — edit your existing review instead", "ALREADY_REVIEWED", 409);
    throw err;
  }

  let mediaDocs = [];
  if (media?.length) {
    mediaDocs = await ReviewMedia.insertMany(media.map((m) => ({ review: review._id, ...m })));
  }

  if (status === "published") await onReviewPublished(review, mediaDocs.some((m) => m.type === "image"));

  if (status === "pending") {
    // Only surfaces to admins when moderation is actually needed — an
    // auto-published review (status "published") doesn't need a
    // moderation-queue alert.
    await eventBus.publish(EVENT_TYPES.REVIEW_CREATED, { entityId: String(review._id), productName: product.name }, { source: "review" });
  }

  logAuditEvent("REVIEW_CREATED", userId, { reviewId: String(review._id), productId, status });
  return { review, media: mediaDocs };
}

// PATCH /reviews/:id — { rating?, title?, body? }. Ownership enforced by
// the {_id, user} query, never a separate role check (rule #41).
export async function updateReview(reviewId, userId, { rating, title, body }) {
  const review = await Review.findOne({ _id: reviewId, user: userId });
  if (!review) fail("Review not found", "REVIEW_NOT_FOUND", 404);
  if (review.status === "deleted") fail("This review has been deleted", "REVIEW_NOT_EDITABLE", 409);

  const wasPublished = review.status === "published";
  const oldRating = review.rating;

  if (rating !== undefined) { assertValidRating(rating); review.rating = rating; }
  if (title !== undefined) review.title = sanitizePlainText(title);
  if (body !== undefined) review.body = sanitizePlainText(body);
  await review.save();

  if (wasPublished && rating !== undefined) await onPublishedRatingChanged(review, oldRating);

  logAuditEvent("REVIEW_UPDATED", userId, { reviewId: String(review._id) });
  return review;
}

// DELETE /reviews/:id — soft delete (rule #11/#100): status flips to
// "deleted", the document and its history stay.
export async function softDeleteReview(reviewId, userId) {
  const review = await Review.findOne({ _id: reviewId, user: userId });
  if (!review) fail("Review not found", "REVIEW_NOT_FOUND", 404);

  const wasPublished = review.status === "published";
  const hasPhoto = (await ReviewMedia.countDocuments({ review: review._id, type: "image", status: "ready" })) > 0;

  review.status = "deleted";
  await review.save();
  if (wasPublished) await onReviewUnpublished(review, hasPhoto);

  logAuditEvent("REVIEW_DELETED", userId, { reviewId: String(review._id) });
  return review;
}

const SORTS = {
  newest: { createdAt: -1 },
  highest_rating: { rating: -1, createdAt: -1 },
  lowest_rating: { rating: 1, createdAt: -1 },
  most_helpful: { helpfulCount: -1, createdAt: -1 },
};

// GET /products/:productId/reviews — public, PUBLISHED only (rule #12:
// never expose unpublished reviews). Paginated (rule #46) — never every
// review for a popular product in one response.
export async function getProductReviews(productId, { sort = "newest", rating, verifiedOnly, hasPhotos, page = 1, limit = 20 }) {
  const filter = { product: productId, status: "published" };
  if (rating) filter.rating = Number(rating);
  if (verifiedOnly === "true" || verifiedOnly === true) filter.isVerifiedPurchase = true;

  let reviewIds = null;
  if (hasPhotos === "true" || hasPhotos === true) {
    reviewIds = await ReviewMedia.distinct("review", { type: "image", status: "ready" });
    filter._id = { $in: reviewIds };
  }

  const sortSpec = SORTS[sort] || SORTS.newest;
  const [reviews, total] = await Promise.all([
    Review.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(Number(limit))
      .populate("user", "firstName lastName"),
    Review.countDocuments(filter),
  ]);

  const media = await ReviewMedia.find({ review: { $in: reviews.map((r) => r._id) }, status: "ready" });
  const mediaByReview = new Map();
  for (const m of media) {
    const key = String(m.review);
    if (!mediaByReview.has(key)) mediaByReview.set(key, []);
    mediaByReview.get(key).push(m);
  }

  return {
    reviews: reviews.map((r) => ({ review: r, media: mediaByReview.get(String(r._id)) || [] })),
    page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit),
  };
}

export async function getReviewSummary(productId) {
  const product = await Product.findById(productId, "rating reviewsCount ratingDistribution verifiedReviewCount photoReviewCount");
  if (!product) fail("Product not found", "REVIEW_NOT_FOUND", 404);
  return {
    averageRating: product.rating,
    reviewCount: product.reviewsCount,
    ratingDistribution: product.ratingDistribution,
    verifiedReviewCount: product.verifiedReviewCount,
    photoReviewCount: product.photoReviewCount,
  };
}

export async function getMyReviews(userId, { page = 1, limit = 20 } = {}) {
  const filter = { user: userId, status: { $ne: "deleted" } };
  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("product", "name slug"),
    Review.countDocuments(filter),
  ]);
  return { reviews, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export { fail, moderate };
