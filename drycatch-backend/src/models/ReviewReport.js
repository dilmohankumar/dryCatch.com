import mongoose from "mongoose";

const reviewReportSchema = new mongoose.Schema(
  {
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: {
      type: String,
      enum: ["spam", "offensive", "fake_review", "irrelevant", "abusive", "other"],
      required: true,
    },
    description: { type: String, maxlength: 1000 },
    status: { type: String, enum: ["open", "under_review", "resolved", "dismissed"], default: "open" },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One active report per (review, customer) — prevents a single user from
// spamming reports on the same review to force moderator attention (rule
// #36's "prevent duplicate active reports").
reviewReportSchema.index({ review: 1, user: 1 }, { unique: true });
reviewReportSchema.index({ review: 1 });
reviewReportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ReviewReport", reviewReportSchema);
