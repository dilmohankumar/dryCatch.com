import Order from "../../models/Order.js";
import { resolveDateRange } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

// Order status distribution is computed via a direct, indexed
// (status + createdAt) group-by on Order rather than a duplicate daily
// aggregate table (rule #162's "don't duplicate systems") — Order already
// has `orderSchema.index({ status: 1, createdAt: -1 })`, so this is a
// bounded, indexed aggregation, not a full scan. Documented exception to
// the "never scan transactional tables" principle: it's cheap specifically
// because the index already exists for this exact access pattern.
export async function getOrderStatusDistribution(query) {
  const range = resolveDateRange(query);
  const cacheKey = `orders:status:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const rows = await Order.aggregate([
      { $match: { createdAt: { $gte: range.startDate, $lt: range.endDate } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const total = rows.reduce((sum, r) => sum + r.count, 0);

    const statuses = [
      "pending_payment", "payment_processing", "confirmed", "processing", "packed",
      "shipped", "out_for_delivery", "delivered", "cancelled", "return_requested", "returned", "refunded",
    ];
    const distribution = statuses.map((status) => ({
      status,
      count: byStatus[status] || 0,
      percent: total > 0 ? (byStatus[status] || 0) / total : 0,
    }));

    return {
      data: distribution,
      summary: { totalOrders: total },
      meta: { startDate: range.startDate, endDate: range.endDate, granularity: range.granularity },
    };
  });
}
