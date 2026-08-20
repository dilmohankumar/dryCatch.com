import mongoose from "mongoose";

// One send attempt on one channel for one Notification (rule #19/#57).
// Folds what the spec calls "NotificationProviderLog" into this single
// model rather than a parallel table — every field the spec wants tracked
// (provider, providerMessageId, errorCode, attempt, timestamps) already
// lives here per-attempt, and a second table would just be this data
// duplicated. Documented as a deliberate simplification, same reasoning
// as Phase 15's single ContentRevision model.
const notificationDeliverySchema = new mongoose.Schema(
  {
    notification: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true, index: true },
    channel: { type: String, enum: ["email", "sms", "push", "in_app", "web_push", "whatsapp"], required: true },
    recipient: { type: String }, // email address / phone / device token — NOT the full user doc
    provider: { type: String }, // "console" | "smtp" | "twilio" | "fcm" | ...
    status: {
      type: String,
      enum: ["pending", "queued", "processing", "sent", "delivered", "failed", "bounced", "cancelled", "retrying"],
      default: "pending",
      index: true,
    },
    attempt: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextAttemptAt: { type: Date, index: true }, // when a "retrying" delivery becomes eligible again
    providerMessageId: String,
    errorCode: String,
    errorMessage: String,
    errorClass: { type: String, enum: ["temporary", "permanent", "rate_limited", "invalid_recipient", "provider_outage"] },
    sentAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    openedAt: Date, // best-effort, provider-dependent (rule #62)
    clickedAt: Date,
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ notification: 1, channel: 1 });
notificationDeliverySchema.index({ status: 1, nextAttemptAt: 1 }); // the retry worker's query

export default mongoose.model("NotificationDelivery", notificationDeliverySchema);
