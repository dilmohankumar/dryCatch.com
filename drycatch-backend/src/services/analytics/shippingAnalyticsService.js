import Shipment from "../../models/Shipment.js";
import ShippingDailyMetric from "../../models/ShippingDailyMetric.js";
import { resolveDateRange, dateKeysBetween } from "../../utils/dateRange.js";
import { percentile } from "./metricService.js";
import { cached } from "../../utils/analyticsCache.js";

export async function getShippingAnalytics(query) {
  const range = resolveDateRange(query);
  const cacheKey = `shipping:${range.startDate.toISOString()}:${range.endDate.toISOString()}`;

  return cached(cacheKey, 60_000, async () => {
    const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
    const rows = await ShippingDailyMetric.find({ dateKey: { $in: dateKeys } }).lean();

    const totals = rows.reduce(
      (acc, r) => ({
        shipmentsCreated: acc.shipmentsCreated + r.shipmentsCreated,
        delivered: acc.delivered + r.delivered,
        inTransit: acc.inTransit + r.inTransit,
        cancelled: acc.cancelled + r.cancelled,
        returned: acc.returned + r.returned,
        shippingCostTotal: acc.shippingCostTotal + r.shippingCostTotal,
        deliveryTimeSumHours: acc.deliveryTimeSumHours + r.deliveryTimeSumHours,
        deliveryTimeCount: acc.deliveryTimeCount + r.deliveryTimeCount,
      }),
      { shipmentsCreated: 0, delivered: 0, inTransit: 0, cancelled: 0, returned: 0, shippingCostTotal: 0, deliveryTimeSumHours: 0, deliveryTimeCount: 0 }
    );

    const allSamples = rows.flatMap((r) => r.deliveryTimeSamplesHours || []).sort((a, b) => a - b);

    // "delayed" (rule #35/#36) is a LIVE gauge, not a day-bucketed count —
    // no domain event exists for "this shipment is now late", so it's
    // computed here directly against the (small, indexed-by-status)
    // Shipment collection rather than faked into the daily aggregate.
    const delayedNow = await Shipment.countDocuments({
      status: { $nin: ["delivered", "cancelled", "rto_delivered", "delivery_failed"] },
      estimatedDeliveryTo: { $lt: new Date() },
    });

    return {
      summary: {
        ...totals,
        averageDeliveryTimeHours: totals.deliveryTimeCount > 0 ? totals.deliveryTimeSumHours / totals.deliveryTimeCount : 0,
        medianDeliveryTimeHours: percentile(allSamples, 50),
        p90DeliveryTimeHours: percentile(allSamples, 90),
        p95DeliveryTimeHours: percentile(allSamples, 95),
        delayedNow,
      },
      meta: {
        startDate: range.startDate,
        endDate: range.endDate,
        percentileNote: allSamples.length < totals.deliveryTimeCount
          ? "Percentiles are estimated from a capped sample (max 500/day), not every delivery — see ShippingDailyMetric."
          : undefined,
      },
    };
  });
}
