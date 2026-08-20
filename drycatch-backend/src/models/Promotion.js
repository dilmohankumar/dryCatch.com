import mongoose from "mongoose";

// The actual discount rule — separate from Coupon (the customer-facing
// code that activates one). A Promotion can be automatic (no code needed,
// requiresCoupon: false) or coupon-gated; either way, the discount math and
// eligibility rules live here, never duplicated onto Coupon.
const promotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,

    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING", "BUY_X_GET_Y", "BUY_X_GET_PERCENTAGE", "BUY_X_GET_FIXED_PRICE"],
      required: true,
    },
    // DRAFT/SCHEDULED/EXPIRED/ARCHIVED are all derived at read time from
    // status + startAt/endAt (see promotionEngine.js#getEffectiveStatus) —
    // the stored field only ever needs to distinguish an admin's intent
    // (active vs deliberately paused vs archived), not the time-derived
    // states, which is why PENDING_APPROVAL-style values aren't stored here.
    status: { type: String, enum: ["active", "paused", "archived"], default: "active" },
    priority: { type: Number, default: 0 }, // higher wins when promotions conflict

    startAt: Date,
    endAt: Date,

    // ---- conditions (eligibility) ----
    conditions: {
      minSubtotal: { type: Number, default: 0 },
      minQuantity: Number,
      productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      variantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" }],
      categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
      excludedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      excludedCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
      customerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // empty = all customers
      firstOrderOnly: { type: Boolean, default: false },
    },

    // ---- actions (the discount itself) ----
    actions: {
      value: Number, // PERCENTAGE (0-100) or FIXED_AMOUNT (rupees)
      maxDiscount: Number, // caps a PERCENTAGE discount
      buyQuantity: Number, // BUY_X_GET_*
      getQuantity: Number,
      getDiscountPercent: Number, // BUY_X_GET_PERCENTAGE
      getFixedPrice: Number, // BUY_X_GET_FIXED_PRICE
    },

    requiresCoupon: { type: Boolean, default: true }, // false = automatic promotion, evaluated on every cart
    usageLimit: Number, // total redemptions across all customers, undefined = unlimited
    usageCount: { type: Number, default: 0 },
    perCustomerLimit: { type: Number, default: 1 },

    stackable: { type: Boolean, default: false }, // may combine with OTHER stackable promotions
    exclusive: { type: Boolean, default: false }, // if eligible, no other promotion may apply at all

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

promotionSchema.index({ status: 1, startAt: 1, endAt: 1 });
promotionSchema.index({ priority: -1 });
promotionSchema.index({ requiresCoupon: 1, status: 1 });

export default mongoose.model("Promotion", promotionSchema);
