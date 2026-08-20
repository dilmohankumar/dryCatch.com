import Review from "../models/Review.js";
import ReviewMedia from "../models/ReviewMedia.js";
import * as reviewModerationService from "../services/reviews/reviewModerationService.js";
import * as reviewReportService from "../services/reviews/reviewReportService.js";

// GET /admin/reviews — ?status=&product=&rating=&page=&limit= — the
// moderation queue (rule #38): Pending / Published / Rejected / Hidden,
// filterable, never everything in one unpaginated blob.
export async function listReviews(req, res) {
  const { status, product, rating, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (product) filter.product = product;
  if (rating) filter.rating = Number(rating);

  const [reviews, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
      .populate("user", "firstName lastName email").populate("product", "name slug"),
    Review.countDocuments(filter),
  ]);
  res.json({ reviews, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}

export async function getReview(req, res) {
  const review = await Review.findById(req.params.id)
    .populate("user", "firstName lastName email").populate("product", "name slug").populate("order", "orderNumber");
  if (!review) return res.status(404).json({ message: "Review not found" });
  const media = await ReviewMedia.find({ review: review._id });
  const reports = await reviewReportService.listReports({}).then((r) => r.reports.filter((rep) => String(rep.review._id) === String(review._id)));
  res.json({ review, media, reports });
}

// PATCH /admin/reviews/:id/status — { action: "approve"|"reject"|"hide"|"restore", reason? }
export async function patchReviewStatus(req, res) {
  const { action, reason } = req.body;
  const review = await reviewModerationService.moderate(req.params.id, action, req.user._id, reason);
  res.json({ review });
}

export async function patchFeatured(req, res) {
  const review = await Review.findByIdAndUpdate(req.params.id, { featured: Boolean(req.body.featured) }, { new: true });
  if (!review) return res.status(404).json({ message: "Review not found" });
  res.json({ review });
}

// ---- Reports ----

export async function listReports(req, res) {
  const result = await reviewReportService.listReports(req.query);
  res.json(result);
}

export async function patchReport(req, res) {
  const report = await reviewReportService.resolveReport(req.params.id, req.user._id, req.body.status);
  res.json({ report });
}
