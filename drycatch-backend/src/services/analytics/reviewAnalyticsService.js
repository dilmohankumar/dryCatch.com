import Review from "../../models/Review.js";
import { resolveDateRange } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

// Direct query on Review (already indexed by status+createdAt for the
// moderation queue) — same "cheap indexed direct query" exception as
// orders/inventory, no duplicate daily aggregate needed at this volume.
export async function getReviewAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `reviews:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const match = { createdAt: { $gte: range.startDate, $lt: range.endDate } };
    const [statusRows, ratingRows] = await Promise.all([
      Review.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Review.aggregate([{ $match: { ...match, status: "published" } }, { $group: { _id: "$rating", count: { $sum: 1 } } }]),
    ]);

    const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.count]));
    const total = statusRows.reduce((s, r) => s + r.count, 0);
    const published = byStatus.published || 0;

    const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: ratingRows.find((row) => row._id === r)?.count || 0 }));
    const ratingSum = ratingDistribution.reduce((s, r) => s + r.rating * r.count, 0);
    const averageRating = published > 0 ? ratingSum / published : 0;

    return {
      summary: {
        totalReviews: total,
        published,
        pending: byStatus.pending || 0,
        rejected: byStatus.rejected || 0,
        hidden: byStatus.hidden || 0,
        approvalRate: total > 0 ? published / total : 0,
        averageRating,
      },
      ratingDistribution,
      meta: { startDate: range.startDate, endDate: range.endDate },
    };
  });
}
