import ProductDailyMetric from "../../models/ProductDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

const SORT_WHITELIST = { revenue: "revenue", units: "unitsSold", views: "views", orders: "purchases" };

// Top products (rule #24) — whitelisted sort field only (rule #79: never
// let a client pick an arbitrary DB field to sort by).
export async function getTopProducts(query) {
  const range = resolveDateRange(query);
  const sortField = SORT_WHITELIST[query.sortBy] || "revenue";
  const limit = Math.min(Number(query.limit) || 20, 100);
  const page = Math.max(Number(query.page) || 1, 1);

  const cacheKey = `products:top:${range.startDate.toISOString()}:${range.endDate.toISOString()}:${sortField}:${page}:${limit}`;
  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await ProductDailyMetric.aggregate([
      { $match: { dateKey: { $in: dateKeys } } },
      {
        $group: {
          _id: "$product",
          views: { $sum: "$views" },
          addToCart: { $sum: "$addToCart" },
          purchases: { $sum: "$purchases" },
          unitsSold: { $sum: "$unitsSold" },
          revenue: { $sum: "$revenue" },
          refundAmount: { $sum: "$refundAmount" },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: "$_id",
          name: "$product.name",
          slug: "$product.slug",
          views: 1, addToCart: 1, purchases: 1, unitsSold: 1, revenue: 1, refundAmount: 1,
          conversionRate: { $cond: [{ $gt: ["$views", 0] }, { $divide: ["$purchases", "$views"] }, 0] },
        },
      },
    ]);

    return { data: rows, meta: { startDate: range.startDate, endDate: range.endDate, sortBy: sortField, page, limit } };
  });
}
