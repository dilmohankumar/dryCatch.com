import mongoose from "mongoose";

// A cart belongs to EITHER a logged-in user OR an anonymous guest (identified
// by a secure random id in an httpOnly cookie — see middleware/cartIdentity.js),
// never both. Totals are deliberately NOT stored here — they're recalculated
// from CartItem + live variant pricing + live inventory on every read (see
// services/cartService.js#getCartSummary), so a stale persisted total can
// never drift from reality.
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestId: { type: String, default: null },
    status: { type: String, enum: ["active", "converted", "abandoned", "expired"], default: "active" },
    currency: { type: String, default: "INR" },
    expiresAt: Date,
  },
  { timestamps: true }
);

// At most one ACTIVE cart per user / per guest — enforced by the database,
// not just application logic, so concurrent requests can never create two.
cartSchema.index({ user: 1, status: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" }, status: "active" } });
cartSchema.index({ guestId: 1, status: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: "string" }, status: "active" } });
cartSchema.index({ expiresAt: 1 });

export default mongoose.model("Cart", cartSchema);
