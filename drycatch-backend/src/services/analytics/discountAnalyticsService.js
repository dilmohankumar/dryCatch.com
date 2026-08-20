import DiscountDailyMetric from "../../models/DiscountDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

export async function getCouponPerformance(query) {
  const range = resolveDateRange(query);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const cacheKey = `discounts:${range.startDate.toISOString()}:${range.endDate.toISOString()}:${limit}`;

  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await DiscountDailyMetric.aggregate([
      { $match: { dateKey: { $in: dateKeys } } },
      { $group: { _id: "$couponCode", usageCount: { $sum: "$usageCount" }, discountAmount: { $sum: "$discountAmount" }, revenue: { $sum: "$revenue" } } },
      { $sort: { usageCount: -1 } },
      { $limit: limit },
      { $project: { couponCode: "$_id", usageCount: 1, discountAmount: 1, revenue: 1, averageOrderValue: { $cond: [{ $gt: ["$usageCount", 0] }, { $divide: ["$revenue", "$usageCount"] }, 0] } } },
    ]);

    const totals = rows.reduce((acc, r) => ({ usageCount: acc.usageCount + r.usageCount, discountAmount: acc.discountAmount + r.discountAmount, revenue: acc.revenue + r.revenue }), { usageCount: 0, discountAmount: 0, revenue: 0 });

    return { data: rows, summary: totals, meta: { startDate: range.startDate, endDate: range.endDate } };
  });
}
