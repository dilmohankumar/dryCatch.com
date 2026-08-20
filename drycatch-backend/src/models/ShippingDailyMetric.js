import mongoose from "mongoose";

// `deliveryTimeSamplesHours` is a capped reservoir (max 500/day) used to
// estimate median/P90/P95 delivery time (rule #35: "do not rely only on
// averages") without storing every single delivery time forever. Capped
// sampling is a documented approximation, not exact percentiles — exact
// percentiles would require scanning every Shipment, which is exactly what
// this table exists to avoid.
const MAX_SAMPLES = 500;

const shippingDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true },
    shipmentsCreated: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    inTransit: { type: Number, default: 0 },
    delayed: { type: Number, default: 0 }, // documented heuristic — see shippingAnalyticsService.js
    cancelled: { type: Number, default: 0 },
    returned: { type: Number, default: 0 },
    shippingCostTotal: { type: Number, default: 0 },
    deliveryTimeSumHours: { type: Number, default: 0 },
    deliveryTimeCount: { type: Number, default: 0 },
    deliveryTimeSamplesHours: { type: [Number], default: [] },
  },
  { timestamps: true }
);

shippingDailyMetricSchema.methods.pushSample = function pushSample(hours) {
  if (this.deliveryTimeSamplesHours.length < MAX_SAMPLES) this.deliveryTimeSamplesHours.push(hours);
};

export default mongoose.model("ShippingDailyMetric", shippingDailyMetricSchema);
