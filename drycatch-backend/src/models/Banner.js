import mongoose from "mongoose";

// Scheduling (rule #39) is enforced by comparing startDate/endDate against
// "now" at READ time (bannerService.getActiveBanners) — same lazy-check
// pattern as Checkout/Cart expiry elsewhere in this project (no background
// scheduler exists to flip a status field automatically).
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" },
    mobileImage: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" },
    link: String,
    cta: String,
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    priority: { type: Number, default: 0 },
    // Targeting (rule #40) — kept simple (where it shows), not full
    // customer-segment/device/region personalization, which the spec
    // itself says not to build unless required.
    target: { type: String, enum: ["homepage", "category", "collection"], default: "homepage" },
    targetId: mongoose.Schema.Types.ObjectId, // ref Category or Collection, depending on `target`

    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bannerSchema.index({ status: 1, startDate: 1, endDate: 1 });
bannerSchema.index({ target: 1, targetId: 1 });

export default mongoose.model("Banner", bannerSchema);
