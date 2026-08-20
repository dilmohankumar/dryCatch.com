import mongoose from "mongoose";

// Append-only snapshot taken every time a template is saved (rule #39) —
// same restore-creates-new-revision pattern as Phase 15's ContentRevision:
// "rollback" never rewrites history, it publishes a new version copied
// from an old one.
const notificationTemplateRevisionSchema = new mongoose.Schema(
  {
    template: { type: mongoose.Schema.Types.ObjectId, ref: "NotificationTemplate", required: true, index: true },
    version: { type: Number, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // {subject, body, variables, status}
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

notificationTemplateRevisionSchema.index({ template: 1, version: 1 });

export default mongoose.model("NotificationTemplateRevision", notificationTemplateRevisionSchema);
