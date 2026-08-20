import mongoose from "mongoose";

// Phase 24 — one referral EVENT per successful signup-via-code (not the
// code itself — see ReferralCode.js for the stable, one-per-user code).
// Reward issuance is a separate, explicit step (`qualified` ->
// `reward_issued`) gated by a real qualifying action (the referred
// user's first order), not just signup — rule #27's "QUALIFYING ACTION"
// stage in the referral flow diagram.
const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referredUserIp: String, // one of several fraud signals (rule #28) — never the only one relied on
    status: {
      type: String,
      enum: ["pending", "qualified", "reward_issued", "rejected"],
      default: "pending",
    },
    qualifyingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // the referred user's first real order
    rejectionReason: String, // e.g. "self_referral", "same_ip_as_referrer"
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ referredUser: 1 }, { unique: true }); // a user can be referred exactly once, ever

export default mongoose.model("Referral", referralSchema);
