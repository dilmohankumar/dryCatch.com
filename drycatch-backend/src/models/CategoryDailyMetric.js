import mongoose from "mongoose";

const categoryDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    revenue: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    units: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categoryDailyMetricSchema.index({ dateKey: 1, category: 1 }, { unique: true });
categoryDailyMetricSchema.index({ category: 1, dateKey: -1 });

export default mongoose.model("CategoryDailyMetric", categoryDailyMetricSchema);
