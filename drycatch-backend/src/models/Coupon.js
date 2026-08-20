import mongoose from "mongoose";

// A customer-facing code that ACTIVATES a Promotion — never a second copy
// of the discount rule (Phase 7's original Coupon model conflated the two;
// this phase splits them per the spec's core "Promotion vs Coupon"
// distinction). Every override field below is optional and falls back to
// the linked Promotion's own value when unset — a Coupon only needs to
// exist at all when a Promotion requires a code (`requiresCoupon: true`).
const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion", required: true },

    status: { type: String, enum: ["active", "paused", "archived"], default: "active" },

    // Overrides — undefined means "use the Promotion's own value."
    usageLimit: Number,
    usageCount: { type: Number, default: 0 },
    perCustomerLimit: Number,
    startAt: Date,
    endAt: Date,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

couponSchema.index({ promotion: 1 });
couponSchema.index({ status: 1 });

export default mongoose.model("Coupon", couponSchema);
