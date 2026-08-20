import CategoryDailyMetric from "../../models/CategoryDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

const SORT_WHITELIST = { revenue: "revenue", units: "units", orders: "orders" };

export async function getTopCategories(query) {
  const range = resolveDateRange(query);
  const sortField = SORT_WHITELIST[query.sortBy] || "revenue";
  const limit = Math.min(Number(query.limit) || 20, 100);

  const cacheKey = `categories:top:${range.startDate.toISOString()}:${range.endDate.toISOString()}:${sortField}:${limit}`;
  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await CategoryDailyMetric.aggregate([
      { $match: { dateKey: { $in: dateKeys } } },
      { $group: { _id: "$category", revenue: { $sum: "$revenue" }, orders: { $sum: "$orders" }, units: { $sum: "$units" }, refundAmount: { $sum: "$refundAmount" } } },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      { $project: { categoryId: "$_id", name: "$category.name", slug: "$category.slug", revenue: 1, orders: 1, units: 1, refundAmount: 1 } },
    ]);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return {
      data: rows.map((r) => ({ ...r, revenueSharePercent: totalRevenue > 0 ? r.revenue / totalRevenue : 0 })),
      meta: { startDate: range.startDate, endDate: range.endDate, sortBy: sortField },
    };
  });
}
