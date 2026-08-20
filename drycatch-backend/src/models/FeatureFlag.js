import mongoose from "mongoose";

// Phase 24 — a deliberately simple feature-flag model (rule #48: "do not
// deploy risky growth features to every user immediately"). Single-tenant
// project (documented since Phase 15) — no per-tenant targeting dimension;
// supports a global on/off, a percentage rollout (stable per-user via
// hashing, not random-per-request), and an explicit kill switch
// (`enabled: false` always wins regardless of rollout percentage).
const featureFlagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true }, // e.g. "new_checkout_cta"
    description: { type: String, required: true },
    enabled: { type: Boolean, default: false }, // the kill switch — false always means false, regardless of rolloutPercent
    rolloutPercent: { type: Number, default: 100, min: 0, max: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("FeatureFlag", featureFlagSchema);
