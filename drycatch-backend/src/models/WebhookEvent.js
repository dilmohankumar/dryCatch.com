import mongoose from "mongoose";

// Records every processed payment-provider webhook event by its provider-
// assigned event id — the idempotency guard for webhook retries (Razorpay,
// like most providers, retries webhooks that don't get a fast 2xx, and may
// resend an already-processed event).
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, default: "razorpay" },
    providerEventId: { type: String, required: true },
    type: String,
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });

export default mongoose.model("WebhookEvent", webhookEventSchema);
