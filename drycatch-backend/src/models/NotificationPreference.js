import mongoose from "mongoose";

// One doc per user (rule #31). Safe defaults live centrally in
// preferenceService.js's DEFAULT_PREFERENCES, never scattered as
// `if (user.emailNotification)` checks (rule #32) — this doc only stores
// deviations from default once a user actually changes something, via
// upsert-on-write, so a fresh user is fully covered by the code default
// without needing a migration to backfill a row for them.
const channelToggle = { email: Boolean, sms: Boolean, push: Boolean, in_app: Boolean };

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    transactional: channelToggle,
    marketing: channelToggle,
    security: channelToggle,
    orderUpdates: channelToggle,
    shippingUpdates: channelToggle,
    reviews: channelToggle,
    promotions: channelToggle,
    unsubscribedAt: Date, // global marketing unsubscribe (rule #33) — overrides all `marketing.*` toggles
  },
  { timestamps: true }
);

export default mongoose.model("NotificationPreference", notificationPreferenceSchema);
