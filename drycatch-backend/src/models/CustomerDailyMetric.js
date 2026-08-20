import mongoose from "mongoose";

// New-vs-returning split by business day (rule #16/#19). "Active"/"inactive"
// customer counts are intentionally NOT stored here — this project has no
// login-activity tracking (User has no lastLoginAt), so "active" is defined
// as "placed an order in the window", computed on demand from Order
// (documented in docs/analytics.md rather than faked from data that
// doesn't exist).
const customerDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true },
    newCustomers: { type: Number, default: 0 }, // first order ever placed on this day
    returningCustomers: { type: Number, default: 0 }, // placed an order, but not their first
    newCustomerRevenue: { type: Number, default: 0 },
    returningCustomerRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("CustomerDailyMetric", customerDailyMetricSchema);
