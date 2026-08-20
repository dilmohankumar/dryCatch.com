import FunnelDailyMetric from "../../models/FunnelDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { cached } from "../../utils/analyticsCache.js";

const STAGES = [
  { key: "visitors", label: "Visitors" },
  { key: "productViews", label: "Product Views" },
  { key: "addToCart", label: "Add to Cart" },
  { key: "checkoutStarted", label: "Checkout Started" },
  { key: "paymentAttempt", label: "Payment Attempt" },
  { key: "paymentSuccess", label: "Payment Success" },
  { key: "orderCompleted", label: "Order Completed" },
];

// Visitor -> ... -> Order Completed (rule #46/#47). Segmentation by
// device/country/traffic-source/campaign (rule #48) is NOT implemented —
// AnalyticsEvent has a `device` field but funnel aggregates are stored
// without a device dimension (that would multiply the aggregate table's
// cardinality significantly); documented as a Phase 18 candidate rather
// than built speculatively (rule #64 — "only create granularities that are
// actually required").
export async function getFunnelAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `funnel:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await FunnelDailyMetric.find({ dateKey: { $in: dateKeys } }).lean();

    const totals = rows.reduce((acc, r) => {
      for (const stage of STAGES) acc[stage.key] = (acc[stage.key] || 0) + (r[stage.key] || 0);
      return acc;
    }, {});

    let previousCount = null;
    const stages = STAGES.map((stage) => {
      const count = totals[stage.key] || 0;
      const conversionFromPrevious = previousCount ? count / previousCount : 1;
      const dropOffFromPrevious = previousCount ? 1 - conversionFromPrevious : 0;
      const conversionFromStart = totals.visitors > 0 ? count / totals.visitors : 0;
      previousCount = count;
      return { key: stage.key, label: stage.label, count, conversionFromPrevious, dropOffFromPrevious, conversionFromStart };
    });

    return { stages, meta: { startDate: range.startDate, endDate: range.endDate } };
  });
}
