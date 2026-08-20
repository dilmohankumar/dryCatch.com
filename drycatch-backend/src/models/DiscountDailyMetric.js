import mongoose from "mongoose";

const discountDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    couponCode: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 }, // net revenue of orders that used this coupon
  },
  { timestamps: true }
);

discountDailyMetricSchema.index({ dateKey: 1, couponCode: 1 }, { unique: true });
discountDailyMetricSchema.index({ couponCode: 1, dateKey: -1 });

export default mongoose.model("DiscountDailyMetric", discountDailyMetricSchema);
