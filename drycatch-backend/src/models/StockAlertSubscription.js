import mongoose from "mongoose";

// Phase 24 — back-in-stock (rule #20) and price-drop (rule #21)
// subscriptions share one model since they're structurally identical
// (customer + product/variant + "notify me when X happens") — a second,
// near-duplicate model would just be this same shape twice.
const stockAlertSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    type: { type: String, enum: ["back_in_stock", "price_drop"], required: true },
    // Only meaningful for price_drop — the price observed at subscribe
    // time, so "did the price drop" has a baseline to compare against
    // (rule #21 — "track original observed price").
    observedPrice: Number,
    status: { type: String, enum: ["active", "notified", "cancelled"], default: "active" },
    notifiedAt: Date,
  },
  { timestamps: true }
);

// One active subscription per (user, product/variant, type) — prevents a
// customer from double-subscribing and, combined with `status`, prevents
// a duplicate alert being sent for the same restock/price-drop event
// (rule #20 "prevent duplicate alerts" / #21 "prevent repeated alerts for
// the same price event").
stockAlertSubscriptionSchema.index({ user: 1, product: 1, variant: 1, type: 1 }, { unique: true });
stockAlertSubscriptionSchema.index({ product: 1, type: 1, status: 1 });

export default mongoose.model("StockAlertSubscription", stockAlertSubscriptionSchema);
