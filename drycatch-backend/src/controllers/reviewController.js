import Review from "../models/Review.js";
import ReviewMedia from "../models/ReviewMedia.js";
import * as reviewService from "../services/reviews/reviewService.js";
import * as reviewVoteService from "../services/reviews/reviewVoteService.js";
import * as reviewReportService from "../services/reviews/reviewReportService.js";

// POST /products/:productId/reviews
export async function postCreateReview(req, res) {
  const { rating, title, body, variantId, media } = req.body;
  const result = await reviewService.createReview(req.user._id, req.params.productId, { rating, title, body, variantId, media });
  res.status(201).json(result);
}

// GET /products/:productId/reviews — public, ?sort=&rating=&verifiedOnly=&hasPhotos=&page=&limit=
export async function getProductReviews(req, res) {
  const result = await reviewService.getProductReviews(req.params.productId, req.query);
  res.json(result);
}

// GET /products/:productId/reviews/summary — public
export async function getReviewSummary(req, res) {
  const summary = await reviewService.getReviewSummary(req.params.productId);
  res.json(summary);
}

// GET /reviews/my — customer's own review history (rule #83), including
// non-published ones (a customer should see their own pending/rejected
// review, just not other customers').
export async function getMyReviews(req, res) {
  const result = await reviewService.getMyReviews(req.user._id, req.query);
  res.json(result);
}

// GET /reviews/:id — public if published; owner/admin otherwise.
export async function getReview(req, res) {
  const review = await Review.findById(req.params.id).populate("user", "firstName lastName");
  if (!review) return res.status(404).json({ message: "Review not found" });
  const isOwner = String(review.user._id) === String(req.user?._id);
  if (review.status !== "published" && !isOwner && req.user?.role !== "admin") {
    return res.status(404).json({ message: "Review not found" });
  }
  const media = await ReviewMedia.find({ review: review._id, status: "ready" });
  res.json({ review, media });
}

export async function patchReview(req, res) {
  const { rating, title, body } = req.body;
  const review = await reviewService.updateReview(req.params.id, req.user._id, { rating, title, body });
  res.json({ review });
}

export async function deleteReview(req, res) {
  const review = await reviewService.softDeleteReview(req.params.id, req.user._id);
  res.json({ review });
}

// POST /reviews/:id/vote — { vote: "helpful" | "not_helpful" }
export async function postVote(req, res) {
  const review = await reviewVoteService.castVote(req.params.id, req.user._id, req.body.vote);
  res.json({ review });
}

export async function deleteVote(req, res) {
  const review = await reviewVoteService.removeVote(req.params.id, req.user._id);
  res.json({ review });
}

// POST /reviews/:id/report — { reason, description? }
export async function postReport(req, res) {
  const report = await reviewReportService.createReport(req.params.id, req.user._id, req.body);
  res.status(201).json({ report });
}
