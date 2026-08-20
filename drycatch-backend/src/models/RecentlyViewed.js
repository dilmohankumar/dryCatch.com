import mongoose from "mongoose";

// Phase 24 — one row per (viewer, product), upserted on every view with an
// updated `viewedAt` (rather than an array field on User, which would grow
// unbounded and force a full-document rewrite on every product view).
// Supports both guest (anonymousId) and authenticated (userId) viewers —
// exactly one of the two is set, never both, so a single sparse-unique
// compound index per viewer type doesn't collide (Phase 8's compound-
// sparse-index lesson: a SINGLE viewer-type index only excludes a doc when
// its own field is missing, so `userId`/`anonymousId` need one index each,
// not one shared compound index across both).
const recentlyViewedSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    anonymousId: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

recentlyViewedSchema.index({ user: 1, product: 1 }, { unique: true, sparse: true });
recentlyViewedSchema.index({ anonymousId: 1, product: 1 }, { unique: true, sparse: true });
recentlyViewedSchema.index({ user: 1, viewedAt: -1 });
recentlyViewedSchema.index({ anonymousId: 1, viewedAt: -1 });

export default mongoose.model("RecentlyViewed", recentlyViewedSchema);
