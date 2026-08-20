import SearchEvent from "../../models/SearchEvent.js";
import { resolveDateRange } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

// Reuses Phase 13's SearchEvent directly (rule #162 — never duplicate an
// existing system) rather than creating a parallel search-analytics store.
export async function getSearchAnalytics(query) {
  const range = resolveDateRange(query);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const cacheKey = `search:${range.startDate.toISOString()}:${range.endDate.toISOString()}:${limit}`;

  return cached(cacheKey, 60_000, async () => {
    const match = { createdAt: { $gte: range.startDate, $lt: range.endDate } };

    const [totalSearches, zeroResultRows, topQueries, uniqueQueries, clicks, addToCartFromSearch] = await Promise.all([
      SearchEvent.countDocuments({ ...match, type: "performed" }),
      SearchEvent.aggregate([
        { $match: { ...match, type: "no_results" } },
        { $group: { _id: "$normalizedQuery", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
      SearchEvent.aggregate([
        { $match: { ...match, type: "performed" } },
        { $group: { _id: "$normalizedQuery", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]),
      SearchEvent.distinct("normalizedQuery", { ...match, type: "performed" }),
      SearchEvent.countDocuments({ ...match, type: "clicked" }),
      SearchEvent.countDocuments({ ...match, type: "add_to_cart" }),
    ]);

    return {
      summary: {
        totalSearches,
        uniqueQueries: uniqueQueries.length,
        zeroResultSearches: zeroResultRows.reduce((s, r) => s + r.count, 0),
        clickThroughRate: totalSearches > 0 ? clicks / totalSearches : 0,
        // Search -> purchase (rule #42) is NOT directly measurable here —
        // SearchEvent tracks up to add-to-cart, not order completion; a
        // true search-to-purchase link would need the order to carry a
        // "sourced from search" attribution, which doesn't exist yet
        // (documented gap, see docs/analytics.md).
        searchToAddToCartRate: totalSearches > 0 ? addToCartFromSearch / totalSearches : 0,
      },
      topQueries: topQueries.map((q) => ({ query: q._id, count: q.count })),
      zeroResultQueries: zeroResultRows.map((q) => ({ query: q._id, count: q.count })),
      meta: { startDate: range.startDate, endDate: range.endDate },
    };
  });
}
