import mongoose from "mongoose";

// Grain is (day, provider, method) — rule #32/#33 wants both breakdowns;
// storing them on the same row avoids two near-identical tables. "Other
// configured methods" from the spec are whatever `Payment.method` actually
// contains (card/upi/netbanking/wallet/cod) — never invented values.
const paymentDailyMetricSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    provider: { type: String, required: true },
    method: { type: String, default: "unknown" },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    successAmount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

paymentDailyMetricSchema.index({ dateKey: 1, provider: 1, method: 1 }, { unique: true });

export default mongoose.model("PaymentDailyMetric", paymentDailyMetricSchema);
