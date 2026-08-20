import mongoose from "mongoose";

// One logical notification (rule #18/#19) — "Order #1234 shipped" — which
// may fan out to several NotificationDelivery rows, one per channel. This
// model itself is channel-agnostic; it's what the in-app Notification
// Center reads. Deliberately does NOT copy full user/order documents onto
// it (rule #18) — only ids in `data`, resolved by the caller if needed.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // absent for pure admin/system notifications with no single recipient
    recipientType: { type: String, enum: ["customer", "admin", "system"], required: true, index: true },
    eventType: { type: String, required: true, index: true },
    category: { type: String, enum: ["transactional", "system", "security", "marketing", "admin"], required: true, index: true },
    priority: { type: String, enum: ["low", "normal", "high", "critical"], default: "normal" },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { orderId, actionUrl }
    channels: [{ type: String, enum: ["email", "sms", "push", "in_app", "web_push", "whatsapp"] }],
    status: { type: String, enum: ["pending", "sent", "partial", "failed"], default: "pending", index: true },
    readAt: Date,
    archivedAt: Date,
    expiresAt: Date,
    sourceEventId: { type: String, index: true }, // ties back to NotificationEvent for traceability/dedupe
    dedupeKey: { type: String }, // eventType+recipient+window, prevents double-send on duplicate event processing (rule #25/#128) — indexed below (unique+sparse)
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, category: 1, createdAt: -1 });
// Same event should never produce two notifications for the same recipient.
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("Notification", notificationSchema);
