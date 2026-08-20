import mongoose from "mongoose";

// ONE precomputed row per business day (rule #63/#68) — the whole point of
// this table is that the sales overview/chart endpoints read a handful of
// these rows instead of scanning every Order for the period. Updated
// incrementally as domain events arrive (rule #69), never recomputed from
// scratch except by the explicit rebuild path (rebuildService.js).
const dailySalesMetricSchema = new mongoose.Schema(
  {
    // Store-timezone business day, e.g. "2026-08-17" — see utils/businessDate.js.
    // This is the grain key; there is exactly one row per day (rule #64: only
    // the granularities actually required — day only, week/month computed by
    // summing days at query time rather than maintaining 3 parallel tables).
    dateKey: { type: String, required: true, unique: true },
    grossSales: { type: Number, default: 0 }, // sum of order subtotal (product sales before discount/refund)
    discountAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shippingRevenue: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
    unitsSold: { type: Number, default: 0 },
    paidRevenue: { type: Number, default: 0 }, // orders whose payment actually succeeded
    pendingPaymentAmount: { type: Number, default: 0 },
    failedPaymentAmount: { type: Number, default: 0 },
    cancelledCount: { type: Number, default: 0 },
    refundedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("DailySalesMetric", dailySalesMetricSchema);
