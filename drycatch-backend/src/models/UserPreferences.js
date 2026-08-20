import mongoose from "mongoose";

// Deliberately small and flat — add fields as real preference categories
// show up, rather than pre-building every conceivable toggle now.
// Security/transactional notices (OTPs, password-changed, order status) are
// NOT toggleable here on purpose: they aren't marketing and shouldn't be
// silence-able the same way promotional messages are.
const preferencesSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    marketingEmail: { type: Boolean, default: true },
    marketingSms: { type: Boolean, default: false },
    productRecommendations: { type: Boolean, default: true },
    backInStockAlerts: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("UserPreferences", preferencesSchema);
