import mongoose from "mongoose";

// Push token registry (rule #95-97). Tokens are treated as sensitive
// operational identifiers — never returned in full via any API response
// (deviceService only ever returns a masked form + deviceId).
const notificationDeviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ["web", "ios", "android"], required: true },
    pushToken: { type: String, required: true },
    browser: String,
    status: { type: String, enum: ["active", "revoked", "invalid"], default: "active", index: true },
    lastSeenAt: Date,
  },
  { timestamps: true }
);

notificationDeviceSchema.index({ user: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("NotificationDevice", notificationDeviceSchema);
