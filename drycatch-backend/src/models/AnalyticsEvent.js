import mongoose from "mongoose";

// The raw behavioral event layer (rule #62/#57/#58) — client-side events
// (PAGE_VIEW, PRODUCT_VIEW, SEARCH, ADD_TO_CART, CHECKOUT_STARTED, etc.)
// land here via POST /api/v1/analytics/events. Deliberately minimal
// (rule #58: never a full database document) — just ids + a small
// `properties` bag. Retention is finite (see docs/analytics.md) — this is
// not meant to be kept forever.
const analyticsEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true }, // client-generated or server-assigned; the dedupe key (rule #61)
    eventType: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null for anonymous activity
    anonymousId: String, // stable per-browser id, set before login
    sessionId: String,
    timestamp: { type: Date, required: true }, // client-reported event time, NOT createdAt (which is ingestion time)
    source: { type: String, enum: ["web", "mobile", "server"], default: "web" },
    device: { type: String, enum: ["desktop", "mobile", "tablet", "other"], default: "other" },
    page: String, // path only, never a full URL with query/PII
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaVersion: { type: Number, required: true, default: 1 }, // rule #60 — future schema changes stay backward compatible
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ anonymousId: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1 });

export default mongoose.model("AnalyticsEvent", analyticsEventSchema);
