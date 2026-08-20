import DailySalesMetric from "../../models/DailySalesMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import * as metrics from "./metricService.js";
import { cached } from "../../utils/analyticsCache.js";

async function fetchRows(startDate, endDate, offsetMinutes) {
  const dateKeys = dateKeysBetween(startDate, endDate, offsetMinutes);
  const rows = await DailySalesMetric.find({ dateKey: { $in: dateKeys } });
  const byKey = new Map(rows.map((r) => [r.dateKey, r]));
  return dateKeys.map((k) => byKey.get(k) || { dateKey: k });
}

function summarize(rows) {
  const totals = rows.reduce(
    (acc, r) => ({
      grossSales: acc.grossSales + (r.grossSales || 0),
      discountAmount: acc.discountAmount + (r.discountAmount || 0),
      refundAmount: acc.refundAmount + (r.refundAmount || 0),
      taxAmount: acc.taxAmount + (r.taxAmount || 0),
      shippingRevenue: acc.shippingRevenue + (r.shippingRevenue || 0),
      ordersCount: acc.ordersCount + (r.ordersCount || 0),
      unitsSold: acc.unitsSold + (r.unitsSold || 0),
      paidRevenue: acc.paidRevenue + (r.paidRevenue || 0),
      pendingPaymentAmount: acc.pendingPaymentAmount + (r.pendingPaymentAmount || 0),
      failedPaymentAmount: acc.failedPaymentAmount + (r.failedPaymentAmount || 0),
      cancelledCount: acc.cancelledCount + (r.cancelledCount || 0),
      refundedCount: acc.refundedCount + (r.refundedCount || 0),
    }),
    { grossSales: 0, discountAmount: 0, refundAmount: 0, taxAmount: 0, shippingRevenue: 0, ordersCount: 0, unitsSold: 0, paidRevenue: 0, pendingPaymentAmount: 0, failedPaymentAmount: 0, cancelledCount: 0, refundedCount: 0 }
  );
  return {
    ...totals,
    netSales: metrics.netSales(totals),
    totalOrderValue: metrics.totalOrderValue(totals),
    averageOrderValue: metrics.averageOrderValue(totals),
    refundRate: metrics.refundRate(totals),
    cancellationRate: metrics.cancellationRate(totals),
  };
}

// GET /admin/analytics/sales — rule #12/#77. Cached briefly since the
// current period's data is still being written incrementally; historical
// (fully-elapsed) periods could use a longer TTL, kept simple here with one
// short TTL for all ranges (documented — see docs/analytics.md).
export async function getSalesAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `sales:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const currentRows = await fetchRows(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const previousRows = await fetchRows(range.previousStartDate, range.previousEndDate, range.timezoneOffsetMinutes);

    const summary = summarize(currentRows);
    const previousSummary = summarize(previousRows);

    const data = currentRows.map((r) => ({
      date: r.dateKey,
      grossSales: r.grossSales || 0,
      netSales: metrics.netSales(r),
      ordersCount: r.ordersCount || 0,
      unitsSold: r.unitsSold || 0,
      averageOrderValue: metrics.averageOrderValue(r),
      refundAmount: r.refundAmount || 0,
    }));

    return {
      data,
      summary,
      comparison: {
        previous: previousSummary,
        changePercent: {
          netSales: metrics.percentChange(summary.netSales, previousSummary.netSales),
          ordersCount: metrics.percentChange(summary.ordersCount, previousSummary.ordersCount),
          averageOrderValue: metrics.percentChange(summary.averageOrderValue, previousSummary.averageOrderValue),
        },
      },
      meta: { startDate: range.startDate, endDate: range.endDate, granularity: range.granularity, timezoneOffsetMinutes: range.timezoneOffsetMinutes },
    };
  });
}

export { fetchRows, summarize };
