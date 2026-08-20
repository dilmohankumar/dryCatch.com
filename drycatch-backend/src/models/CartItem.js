import mongoose from "mongoose";

// A cart line identifies a VARIANT, never just a product — "500g" and "1kg"
// of the same product are different purchasable items and must be separate
// lines (see docs/cart.md). Only the minimum needed is stored here;
// everything display-worthy (name, image, current price, availability) is
// enriched from the catalog/inventory layers at read time, never duplicated
// into this document.
const cartItemSchema = new mongoose.Schema(
  {
    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Display/history only — e.g. "price when you added this" for a future
    // "price changed since you added it" notice. The authoritative price at
    // checkout always comes fresh from ProductVariant, never from this field.
    priceSnapshot: Number,
  },
  { timestamps: true }
);

// The uniqueness rule cart correctness depends on — one line per variant per
// cart, enforced by MongoDB so a race can never produce two rows for "500g".
cartItemSchema.index({ cart: 1, variant: 1 }, { unique: true });
cartItemSchema.index({ cart: 1 });

export default mongoose.model("CartItem", cartItemSchema);
