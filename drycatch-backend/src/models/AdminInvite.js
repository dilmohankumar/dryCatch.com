import mongoose from "mongoose";

// Admin accounts are never created by directly assigning a password (rule
// #74) — an invite is a one-time token an admin must accept themselves,
// same shape as this project's existing OTP-based signup flow, just for
// staff instead of customers.
const adminInviteSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    token: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "expired", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
  },
  { timestamps: true }
);

adminInviteSchema.index({ email: 1, status: 1 });

export default mongoose.model("AdminInvite", adminInviteSchema);
