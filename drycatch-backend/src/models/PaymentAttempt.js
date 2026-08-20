import mongoose from "mongoose";

// One row per distinct attempt to pay for an order. Kept separate from
// Payment (which represents the current/overall payment state for the
// order) because a single order can have "attempt 1 → FAILED, attempt 2 →
// SUCCEEDED" — overwriting a single Payment row on retry would destroy that
// history, which matters for support/audit/reconciliation.
const paymentAttemptSchema = new mongoose.Schema(
  {
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },

    provider: { type: String, required: true },
    providerReference: String, // provider order/intent id for this specific attempt

    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },

    status: {
      type: String,
      enum: ["created", "pending", "processing", "succeeded", "failed", "cancelled", "expired"],
      default: "created",
    },

    attemptNumber: { type: Number, required: true },

    // Client-supplied Idempotency-Key (payment creation/retry), unique so a
    // retried identical request can never spawn a second attempt row.
    idempotencyKey: { type: String, unique: true, sparse: true },

    failureCode: String,
    failureMessage: String,
  },
  { timestamps: true }
);

paymentAttemptSchema.index({ order: 1, attemptNumber: 1 }, { unique: true });
paymentAttemptSchema.index({ payment: 1 });

export default mongoose.model("PaymentAttempt", paymentAttemptSchema);
