import mongoose from "mongoose";

// The OUTBOX (rule #130). Every business event is persisted here BEFORE
// the notification engine processes it — a worker crash between "event
// happened" and "notification created" loses nothing, it just leaves a
// row with status "pending" that a recovery pass can pick back up.
// `eventId` is the idempotency key (rule #24/#129): the same eventId
// processed twice must not create a second notification.
const notificationEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true, index: true }, // ORDER_CREATED | PAYMENT_SUCCESSFUL | ...
    source: { type: String, required: true }, // order | payment | shipment | inventory | review | cms | auth | cart
    payload: { type: mongoose.Schema.Types.Mixed, required: true }, // minimal ids only, never full documents (rule #23)
    version: { type: Number, default: 1 },
    status: { type: String, enum: ["pending", "processed", "failed"], default: "pending", index: true },
    processedAt: Date,
    error: String,
  },
  { timestamps: true }
);

notificationEventSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("NotificationEvent", notificationEventSchema);
