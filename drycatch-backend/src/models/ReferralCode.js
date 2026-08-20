import mongoose from "mongoose";

// One stable, shareable code per user — generated lazily on first request
// (referralService.getOrCreateCode), never regenerated (a customer's
// shared links/social posts must keep working).
const referralCodeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("ReferralCode", referralCodeSchema);
