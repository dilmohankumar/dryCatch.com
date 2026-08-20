import Order from "../../models/Order.js";
import User from "../../models/User.js";
import CustomerDailyMetric from "../../models/CustomerDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { historicalCLV } from "./metricService.js";
import { cached } from "../../utils/analyticsCache.js";

export async function getCustomerAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `customers:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await CustomerDailyMetric.find({ dateKey: { $in: dateKeys } });
    const byKey = new Map(rows.map((r) => [r.dateKey, r]));
    const data = dateKeys.map((k) => {
      const r = byKey.get(k);
      return { date: k, newCustomers: r?.newCustomers || 0, returningCustomers: r?.returningCustomers || 0, newCustomerRevenue: r?.newCustomerRevenue || 0, returningCustomerRevenue: r?.returningCustomerRevenue || 0 };
    });

    const totalNewCustomers = data.reduce((s, r) => s + r.newCustomers, 0);
    const totalReturningCustomers = data.reduce((s, r) => s + r.returningCustomers, 0);
    const totalCustomers = await User.countDocuments({ role: { $ne: "admin" } });

    // "Active" is defined as "placed an order in the window" — this project
    // tracks no login activity (no lastLoginAt on User), so that's the only
    // honest definition available (documented in docs/analytics.md).
    const activeCustomerIds = await Order.distinct("user", { createdAt: { $gte: range.startDate, $lt: range.endDate } });

    return {
      data,
      summary: {
        totalCustomers,
        newCustomers: totalNewCustomers,
        returningCustomers: totalReturningCustomers,
        activeCustomers: activeCustomerIds.length,
        repeatPurchaseRate: totalNewCustomers + totalReturningCustomers > 0 ? totalReturningCustomers / (totalNewCustomers + totalReturningCustomers) : 0,
      },
      meta: { startDate: range.startDate, endDate: range.endDate, granularity: range.granularity },
    };
  });
}

// Historical CLV over the whole customer base (rule #17/#18) — not
// windowed by the date-range filter, since lifetime value is inherently a
// whole-history metric.
export async function getCustomerLifetimeValue() {
  return cached("customers:clv", 5 * 60_000, async () => {
    const result = await Order.aggregate([
      { $match: { status: { $nin: ["pending_payment", "payment_processing"] } } },
      { $group: { _id: "$user", netRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$discountAmount", 0] }] } }, orders: { $sum: 1 } } },
    ]);
    const totalRevenue = result.reduce((s, r) => s + r.netRevenue, 0);
    const distinctCustomers = result.length;
    const avgOrdersPerCustomer = distinctCustomers > 0 ? result.reduce((s, r) => s + r.orders, 0) / distinctCustomers : 0;

    return {
      historicalCLV: historicalCLV(totalRevenue, distinctCustomers),
      distinctPurchasingCustomers: distinctCustomers,
      averageOrdersPerCustomer: avgOrdersPerCustomer,
      // Predictive CLV / Cohort CLV: NOT implemented — no statistical
      // projection model exists in this codebase (rule #18, documented gap).
      predictiveCLV: null,
      cohortCLV: null,
    };
  });
}

// N-day retention (rule #20) — % of customers whose first order was in
// [acquisitionStart, acquisitionEnd) who placed ANY order again within
// `days` of that first order. Computed on demand via aggregation, not
// materialized — cohort sizes at this project's scale are small enough
// that this is cheap; a materialized cohort table is the natural next step
// if/when order volume grows (documented as a REFACTOR candidate).
export async function getRetention({ days = 30, cohortStart, cohortEnd } = {}) {
  if (!cohortStart || !cohortEnd) {
    throw Object.assign(new Error("cohortStart and cohortEnd are required"), { statusCode: 400, code: "INVALID_COHORT_RANGE" });
  }
  const start = new Date(cohortStart);
  const end = new Date(cohortEnd);

  const firstOrders = await Order.aggregate([
    { $sort: { user: 1, createdAt: 1 } },
    { $group: { _id: "$user", firstOrderAt: { $first: "$createdAt" } } },
    { $match: { firstOrderAt: { $gte: start, $lt: end } } },
  ]);
  const cohortUserIds = firstOrders.map((f) => f._id);
  if (cohortUserIds.length === 0) return { cohortSize: 0, retainedCount: 0, retentionRate: 0 };

  const firstOrderByUser = new Map(firstOrders.map((f) => [String(f._id), f.firstOrderAt]));
  const repeatOrders = await Order.find({ user: { $in: cohortUserIds } }, "user createdAt").lean();

  let retained = 0;
  const seen = new Set();
  for (const order of repeatOrders) {
    const uid = String(order.user);
    if (seen.has(uid)) continue;
    const firstAt = firstOrderByUser.get(uid);
    const withinWindow = order.createdAt > firstAt && (order.createdAt - firstAt) <= days * 24 * 60 * 60 * 1000;
    if (withinWindow) {
      retained++;
      seen.add(uid);
    }
  }

  return { cohortSize: cohortUserIds.length, retainedCount: retained, retentionRate: retained / cohortUserIds.length, days };
}
