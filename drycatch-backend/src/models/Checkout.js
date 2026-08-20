import mongoose from "mongoose";

// A dedicated session between Cart and Order — NOT the same thing as
// either. Cart is "what the customer wants to buy" (mutable, no address/
// shipping/pricing decisions attached). Order is "what was actually
// bought" (immutable once paid). Checkout is the controlled transaction
// in between: address, shipping method, coupon, and a price snapshot,
// walked through a state machine before an Order is ever created.
const addressSnapshotSchema = new mongoose.Schema(
  { line1: String, line2: String, city: String, state: String, pincode: String, phone: String, fullName: String },
  { _id: false }
);

const checkoutItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    sku: String,
    name: String,
    variantLabel: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true }, // snapshotted at last validate() call
    // Phase 11 — this line's share of the current discount, recomputed by
    // promotionEngine.evaluateCart on every pricing pass. Transient/display
    // data until placeOrder freezes it onto the Order's own item snapshot.
    discountAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const checkoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    // See docs/checkout.md for the full transition table. Frontend can
    // never set this directly — every transition happens inside
    // services/checkoutService.js in response to a specific action.
    status: {
      type: String,
      enum: ["active", "validated", "inventory_reserved", "payment_pending", "completed", "expired", "cancelled", "failed"],
      default: "active",
    },

    currency: { type: String, default: "INR" },
    items: [checkoutItemSchema],

    shippingAddress: addressSnapshotSchema,
    billingAddress: addressSnapshotSchema,
    billingSameAsShipping: { type: Boolean, default: true },

    shippingMethodId: String,
    shippingCost: { type: Number, default: 0 },

    couponCode: String,
    discountAmount: { type: Number, default: 0 },
    freeShipping: { type: Boolean, default: false },
    // Transient — recomputed every pricing pass, exposed to the frontend
    // for the discount breakdown UI; frozen onto Order.promotionSnapshots
    // at placeOrder, not read back from here afterward.
    //
    // Wrapped in an explicit sub-schema rather than a bare object literal —
    // a field literally named `type` inside an inline array-of-objects
    // definition is a classic Mongoose ambiguity: it misreads the whole
    // object as a SchemaTypeOptions descriptor for the array itself (cast
    // to [String]) instead of a subdocument schema. An explicit
    // `new mongoose.Schema({...})` removes the ambiguity.
    appliedPromotions: [
      new mongoose.Schema(
        {
          promotion: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
          name: String,
          type: String,
          discountAmount: Number,
          source: String, // "automatic" | "coupon"
        },
        { _id: false }
      ),
    ],

    taxAmount: { type: Number, default: 0 },

    pricing: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // Guards place-order against double-click/retry/network-timeout —
    // unique+sparse so it's only enforced when actually supplied.
    idempotencyKey: { type: String, unique: true, sparse: true },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

checkoutSchema.index({ user: 1, status: 1 });
checkoutSchema.index({ expiresAt: 1 });

export default mongoose.model("Checkout", checkoutSchema);
