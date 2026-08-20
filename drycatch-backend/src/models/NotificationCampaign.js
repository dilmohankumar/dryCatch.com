import mongoose from "mongoose";

// Marketing campaigns (rule #64-68). `audience` is a query descriptor, not
// a hard-coded segment list (rule #67) — audienceService resolves it to
// an actual recipient list at send time. `send` permission is checked
// separately from `create`/`update` in the controller (rule #107) — this
// model just records who created vs who last triggered a send.
const notificationCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "NotificationTemplate", required: true },
    channels: [{ type: String, enum: ["email", "sms", "push", "in_app", "web_push", "whatsapp"] }],
    audience: {
      segment: { type: String, enum: ["all", "new_customers", "inactive", "high_value", "custom"], default: "all" },
      filter: { type: mongoose.Schema.Types.Mixed, default: {} }, // custom segment query descriptor
    },
    status: { type: String, enum: ["draft", "scheduled", "running", "paused", "completed", "cancelled"], default: "draft", index: true },
    startAt: Date,
    endAt: Date,
    timezone: { type: String, default: "Asia/Kolkata" },
    stats: {
      recipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

notificationCampaignSchema.index({ status: 1, startAt: 1 });

export default mongoose.model("NotificationCampaign", notificationCampaignSchema);
