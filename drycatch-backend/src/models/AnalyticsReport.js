import mongoose from "mongoose";

// Scheduled/on-demand reports (rule #83/#84). `schedule` describes intent;
// there is no real cron running it (same honest gap as everywhere else in
// this project) — `POST /admin/analytics/reports/:id/run` is how a report
// actually gets generated today, and a real scheduler would call the same
// endpoint/service function on a timer.
const analyticsReportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, required: true }, // "daily_sales" | "monthly_sales" | "product_performance" | "customer" | "inventory" | "payment" | "shipping" | "discount"
    schedule: { type: String, enum: ["none", "daily", "weekly", "monthly", "custom"], default: "none" },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // admin users only — validated at generation time
    lastRunAt: Date,
    lastStatus: { type: String, enum: ["success", "failed"] },
    lastError: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("AnalyticsReport", analyticsReportSchema);
