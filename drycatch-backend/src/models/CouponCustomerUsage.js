import mongoose from "mongoose";

// The actual per-customer concurrency guard (rule #22/#24) — a unique
// {coupon, customer} document whose `count` is only ever changed via the
// atomic increment-or-create pattern in redemptionService.js. Kept
// separate from CouponRedemption (the audit trail) because this doc's
// entire job is being a single, lockable row two concurrent requests both
// try to touch — mixing that with a growing history log would make the
// atomic update slower and messier as history accumulates.
const couponCustomerUsageSchema = new mongoose.Schema({
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  count: { type: Number, default: 0 },
});

couponCustomerUsageSchema.index({ coupon: 1, customer: 1 }, { unique: true });

export default mongoose.model("CouponCustomerUsage", couponCustomerUsageSchema);
