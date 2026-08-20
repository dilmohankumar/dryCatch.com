import mongoose from "mongoose";

// The audit trail — one row per coupon use, whatever its final outcome.
// This is NOT the concurrency mechanism itself (see CouponCustomerUsage +
// Coupon.usageCount's atomic increment in redemptionService.js) — it's the
// human-readable record of who used what, on which order, for how much.
const couponRedemptionSchema = new mongoose.Schema(
  {
    // Optional — an automatic (no-code) promotion has no Coupon at all;
    // this record still exists so Order.promotionSnapshots always has a
    // matching redemption row to reference, coupon-gated or not.
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // set once the order that redeemed it exists
    checkout: { type: mongoose.Schema.Types.ObjectId, ref: "Checkout" },
    discountAmount: { type: Number, required: true },
    status: { type: String, enum: ["redeemed", "released", "cancelled"], default: "redeemed" },
    redeemedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ coupon: 1 });
couponRedemptionSchema.index({ customer: 1 });
couponRedemptionSchema.index({ order: 1 });

export default mongoose.model("CouponRedemption", couponRedemptionSchema);
