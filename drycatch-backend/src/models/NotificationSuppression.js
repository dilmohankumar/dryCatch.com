import mongoose from "mongoose";

// Suppression list (rule #98/#60/#61) — bounced emails, spam complaints,
// unsubscribes, and manual blocks. Checked before every marketing send
// and before any send to a channel value known to be dead; never
// deleted, only referenced (a suppressed recipient should not silently
// start receiving mail again without deliberate admin action).
const notificationSuppressionSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email", "sms", "push"], required: true },
    value: { type: String, required: true }, // the email/phone/token being suppressed
    reason: { type: String, enum: ["bounce", "complaint", "unsubscribe", "invalid_recipient", "manual"], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: true }
);

notificationSuppressionSchema.index({ channel: 1, value: 1 }, { unique: true });

export default mongoose.model("NotificationSuppression", notificationSuppressionSchema);
