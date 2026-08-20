import PaymentDailyMetric from "../../models/PaymentDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

// Success rate = successful ATTEMPTS / eligible attempts (rule #31) — never
// mixed with order counts, which is why PaymentDailyMetric increments on
// payment-level events (markSucceeded/markFailed in paymentService.js),
// not order-level ones.
export async function getPaymentAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `payments:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await PaymentDailyMetric.find({ dateKey: { $in: dateKeys } }).lean();

    const byMethod = groupSum(rows, "method");
    const byProvider = groupSum(rows, "provider");

    const totals = rows.reduce(
      (acc, r) => ({
        successCount: acc.successCount + r.successCount,
        failedCount: acc.failedCount + r.failedCount,
        successAmount: acc.successAmount + r.successAmount,
        refundCount: acc.refundCount + r.refundCount,
        refundAmount: acc.refundAmount + r.refundAmount,
      }),
      { successCount: 0, failedCount: 0, successAmount: 0, refundCount: 0, refundAmount: 0 }
    );
    const eligibleAttempts = totals.successCount + totals.failedCount;

    return {
      summary: { ...totals, successRate: eligibleAttempts > 0 ? totals.successCount / eligibleAttempts : 0 },
      byMethod,
      byProvider,
      meta: { startDate: range.startDate, endDate: range.endDate },
    };
  });
}

function groupSum(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const k = row[key];
    const existing = map.get(k) || { [key]: k, successCount: 0, failedCount: 0, successAmount: 0, refundCount: 0, refundAmount: 0 };
    existing.successCount += row.successCount;
    existing.failedCount += row.failedCount;
    existing.successAmount += row.successAmount;
    existing.refundCount += row.refundCount;
    existing.refundAmount += row.refundAmount;
    map.set(k, existing);
  }
  return [...map.values()].map((r) => ({ ...r, successRate: r.successCount + r.failedCount > 0 ? r.successCount / (r.successCount + r.failedCount) : 0 }));
}
