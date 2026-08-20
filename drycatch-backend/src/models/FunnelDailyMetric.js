import mongoose from "mongoose";

// Visitor -> Product View -> Add to Cart -> Checkout Started -> Payment
// Attempt -> Payment Success -> Order Completed (rule #46). `visitors` is
// a distinct count of (userId or anonymousId) seen that day — approximated
// via a capped-cardinality counter rather than storing every id here (that
// would defeat the purpose of a daily aggregate); see
// funnelAnalyticsService.js for how it's actually computed.
const funnelDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true },
    visitors: { type: Number, default: 0 },
    productViews: { type: Number, default: 0 },
    addToCart: { type: Number, default: 0 },
    checkoutStarted: { type: Number, default: 0 },
    paymentAttempt: { type: Number, default: 0 },
    paymentSuccess: { type: Number, default: 0 },
    orderCompleted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("FunnelDailyMetric", funnelDailyMetricSchema);
