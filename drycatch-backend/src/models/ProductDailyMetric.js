import mongoose from "mongoose";

const productDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    views: { type: Number, default: 0 },
    addToCart: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 }, // count of orders containing this product
    unitsSold: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productDailyMetricSchema.index({ dateKey: 1, product: 1 }, { unique: true });
productDailyMetricSchema.index({ product: 1, dateKey: -1 });

export default mongoose.model("ProductDailyMetric", productDailyMetricSchema);
