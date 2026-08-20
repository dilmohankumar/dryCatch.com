import mongoose from "mongoose";

// Real production fields, not the pre-Phase-0 flat {product,user,rating,
// comment} shape — verified purchase, moderation, snapshots, and a status
// workflow all matter for a review system that's actually trustworthy.
const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Set only by reviewEligibilityService, from a real Order lookup —
    // never accepted from the client (rule #7/#85). Absent entirely for a
    // non-purchase review (if the store's policy ever allows one).
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    isVerifiedPurchase: { type: Boolean, default: false },

    // Snapshotted at creation (rule #26) — a later product rename doesn't
    // rewrite what the review historically referenced.
    productNameSnapshot: String,
    variantNameSnapshot: String,

    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 5000 },

    // PENDING (awaiting moderation) / PUBLISHED (counts toward the public
    // aggregate) / REJECTED / HIDDEN (was published, pulled) / DELETED
    // (soft — rule #11/#100, history is kept, not destroyed).
    status: {
      type: String,
      enum: ["pending", "published", "rejected", "hidden", "deleted"],
      default: "pending",
    },
    publishedAt: Date,
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    moderationReason: String,

    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },

    featured: { type: Boolean, default: false }, // admin-only (rule #61) — never frontend-settable
  },
  { timestamps: true }
);

// One review per product per customer (a deliberate policy choice, not the
// original model's punted decision — rule #9's "recommended" option).
// Editing is how an opinion changes; soft-deleting still leaves the
// document behind (status: "deleted"), so this also means a customer
// cannot re-review after deleting — an accepted tradeoff for keeping this
// a single, race-safe DB constraint rather than an app-level check with a
// race window.
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 }); // admin moderation queue

export default mongoose.model("Review", reviewSchema);
