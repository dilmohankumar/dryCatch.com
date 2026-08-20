import Review from "../../models/Review.js";
import ReviewReport from "../../models/ReviewReport.js";
import { logAuditEvent } from "../../utils/auditLog.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// POST /reviews/:id/report — { reason, description? }
export async function createReport(reviewId, userId, { reason, description }) {
  const review = await Review.findById(reviewId);
  if (!review) fail("Review not found", "REVIEW_NOT_FOUND", 404);

  try {
    const report = await ReviewReport.create({ review: reviewId, user: userId, reason, description });
    logAuditEvent("REVIEW_REPORTED", userId, { reviewId: String(reviewId), reason });
    return report;
  } catch (err) {
    if (err.code === 11000) fail("You've already reported this review", "REVIEW_ALREADY_REPORTED", 409);
    throw err;
  }
}

export async function listReports({ status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  const [reports, total] = await Promise.all([
    ReviewReport.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
      .populate("review", "title body rating product").populate("user", "firstName lastName"),
    ReviewReport.countDocuments(filter),
  ]);
  return { reports, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// PATCH /admin/review-reports/:id — { status }
export async function resolveReport(reportId, adminId, status) {
  if (!["under_review", "resolved", "dismissed"].includes(status)) fail("Invalid report status", "INVALID_STATUS", 400);
  const report = await ReviewReport.findByIdAndUpdate(
    reportId,
    { status, resolvedAt: ["resolved", "dismissed"].includes(status) ? new Date() : undefined, resolvedBy: adminId },
    { new: true }
  );
  if (!report) fail("Report not found", "REPORT_NOT_FOUND", 404);
  logAuditEvent("REVIEW_REPORT_RESOLVED", adminId, { reportId: String(reportId), status });
  return report;
}

export { fail };
