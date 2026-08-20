import mongoose from "mongoose";

// The provider-agnostic financial record for one order's payment. An order
// has at most one "live" Payment even though it may have many PaymentAttempt
// rows behind it (retries) — this is the thing whose status the rest of the
// system (order confirmation, refunds) actually reads.
const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    checkout: { type: mongoose.Schema.Types.ObjectId, ref: "Checkout" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    provider: { type: String, required: true }, // "razorpay" | "stripe"
    providerPaymentId: String, // set once the provider confirms a specific payment (e.g. razorpay_payment_id)
    providerOrderId: String, // the provider-side order/intent id, set at creation

    amount: { type: Number, required: true }, // minor units (paise), server-computed — never client input
    currency: { type: String, required: true, default: "INR" },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
        "refunded",
        "partially_refunded",
      ],
      default: "created",
    },
    method: String, // card | upi | netbanking | wallet | cod — normalized, never raw provider payment-method payload

    failureCode: String,
    failureMessage: String,

    refundedAmount: { type: Number, default: 0 },

    // Minimal, non-sensitive metadata only — never card numbers, CVV, tokens.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });
// Single-field sparse indexes, not compound-with-provider: a compound sparse
// index only excludes a document when ALL of its fields are missing, so
// {provider, providerOrderId} sparse still indexes every payment missing
// providerOrderId as {provider:"razorpay", providerOrderId:null} — the
// second such document collides on the first. A single-field sparse index
// on providerOrderId alone correctly excludes any doc missing that one
// field, which is what "unique across payments that have one" means here.
paymentSchema.index({ providerOrderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Payment", paymentSchema);
