import mongoose from "mongoose";

// Analytics DLQ (rule #114) — malformed/unprocessable events land here
// instead of silently corrupting AnalyticsEvent or an aggregate. Admin can
// inspect and, once the underlying issue is understood, replay.
const analyticsEventDLQSchema = new mongoose.Schema(
  {
    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, required: true }, // e.g. "unknown eventType", "missing timestamp", "invalid schemaVersion"
    status: { type: String, enum: ["pending", "replayed", "discarded"], default: "pending", index: true },
  },
  { timestamps: true }
);

export default mongoose.model("AnalyticsEventDLQ", analyticsEventDLQSchema);
