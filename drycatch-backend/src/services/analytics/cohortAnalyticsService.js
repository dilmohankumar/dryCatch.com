import Order from "../../models/Order.js";
import { cached } from "../../utils/analyticsCache.js";

// Cohort matrix (rule #21/#92) — rows are monthly acquisition cohorts
// (first-purchase month), columns are months-since-acquisition, values are
// retention rate. Computed on demand via aggregation, not materialized —
// documented scope decision (same as retention in customerAnalyticsService.js):
// cheap enough at this project's order volume, a natural candidate to
// materialize into its own table if/when volume grows.
export async function getCohortMatrix({ monthsBack = 6 } = {}) {
  const cap = Math.min(Number(monthsBack) || 6, 24);
  const cacheKey = `cohorts:${cap}`;

  return cached(cacheKey, 5 * 60_000, async () => {
    const firstOrders = await Order.aggregate([
      { $sort: { user: 1, createdAt: 1 } },
      { $group: { _id: "$user", firstOrderAt: { $first: "$createdAt" } } },
    ]);
    if (firstOrders.length === 0) return { cohorts: [] };

    const firstOrderByUser = new Map(firstOrders.map((f) => [String(f._id), f.firstOrderAt]));
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - cap);

    const relevantUserIds = firstOrders.filter((f) => f.firstOrderAt >= cutoff).map((f) => f._id);
    if (relevantUserIds.length === 0) return { cohorts: [] };

    const allOrders = await Order.find({ user: { $in: relevantUserIds } }, "user createdAt").lean();

    // cohortMonth ("2026-03") -> Set of userIds in that cohort
    const cohortUsers = new Map();
    for (const [userId, firstAt] of firstOrderByUser) {
      if (firstAt < cutoff) continue;
      const cohortMonth = firstAt.toISOString().slice(0, 7);
      if (!cohortUsers.has(cohortMonth)) cohortUsers.set(cohortMonth, new Set());
      cohortUsers.get(cohortMonth).add(userId);
    }

    // For each cohort, for each month-offset, count distinct users who ordered.
    const cohorts = [...cohortUsers.entries()].sort().map(([cohortMonth, userIds]) => {
      const cohortSize = userIds.size;
      const monthBuckets = Array.from({ length: cap + 1 }, () => new Set());

      for (const order of allOrders) {
        const uid = String(order.user);
        if (!userIds.has(uid)) continue;
        const firstAt = firstOrderByUser.get(uid);
        const monthOffset = monthsBetween(firstAt, order.createdAt);
        if (monthOffset >= 0 && monthOffset <= cap) monthBuckets[monthOffset].add(uid);
      }

      return {
        cohortMonth,
        cohortSize,
        retention: monthBuckets.map((set, offset) => ({ monthOffset: offset, retainedCount: set.size, retentionRate: cohortSize > 0 ? set.size / cohortSize : 0 })),
      };
    });

    return { cohorts };
  });
}

function monthsBetween(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}
