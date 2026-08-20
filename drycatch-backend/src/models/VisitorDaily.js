import mongoose from "mongoose";

// Backing store for FunnelDailyMetric.visitors — an exact distinct-visitor
// count needs a per-(day, visitor) row rather than a running counter (a
// counter can't tell "seen before today" from "new"). One upserted row per
// visitor per day; `FunnelDailyMetric.visitors` is `countDocuments({dateKey})`
// after the upsert. Subject to the same retention policy as AnalyticsEvent
// (see docs/analytics.md) — this is not meant to grow forever either.
const visitorDailySchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    visitorKey: { type: String, required: true }, // `user:<id>` or `anon:<anonymousId>`
  },
  { timestamps: true }
);

visitorDailySchema.index({ dateKey: 1, visitorKey: 1 }, { unique: true });

export default mongoose.model("VisitorDaily", visitorDailySchema);
