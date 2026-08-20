import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },

    provider: { type: String, required: true },
    providerRefundId: String,

    amount: { type: Number, required: true }, // minor units, <= payment.amount - payment.refundedAmount
    currency: { type: String, required: true, default: "INR" },

    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending",
    },

    reason: String,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Admin-supplied idempotency key — a double-clicked refund button must
    // not create two provider refunds.
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

refundSchema.index({ payment: 1 });
// Single-field sparse, not compound with provider — same compound-sparse
// pitfall as Payment (see that model's comment): a compound sparse index
// only excludes docs missing ALL listed fields, not just one.
refundSchema.index({ providerRefundId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Refund", refundSchema);
