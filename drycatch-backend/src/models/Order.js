import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Snapshotted at purchase time — an order must keep displaying correctly
    // even if the variant is later archived/repriced or the SKU changes.
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    sku: String,
    name: String,
    variantLabel: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    // Phase 11 — this line's share of the order's total discount, computed
    // by discountAllocator.js and stored here (not recomputed later) so a
    // refund/return can know "this item's actual paid price," not its
    // pre-discount price. Embedded rather than a separate
    // OrderDiscountAllocation collection since order items themselves are
    // already embedded, not their own collection (see FulfillmentItem's
    // equivalent note in Phase 10 about the same tradeoff).
    discountAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human-facing, collision-safe (utils/orderNumber.js) — the customer-
    // and support-facing identifier. The Mongo _id remains the internal
    // reference everywhere else; orderNumber is what's ever shown or
    // searched on by a human.
    orderNumber: { type: String, required: true, unique: true },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Set when the order came through the Checkout session flow (Phase 7)
    // rather than the older direct-create path — lets a webhook/verify call
    // find the originating checkout to advance its state machine too.
    checkout: { type: mongoose.Schema.Types.ObjectId, ref: "Checkout" },
    items: [orderItemSchema],
    // subtotal + shippingCost + taxAmount - discountAmount = totalAmount.
    // Each piece kept separately so the order summary can show a real
    // breakdown, not just a final number. All of these are snapshots taken
    // at order-creation time (Phase 9) — they never get recalculated from
    // live catalog/coupon/tax config later, by design: an old order must
    // keep showing what the customer actually paid even if prices, coupons,
    // or tax rules change afterward.
    currency: { type: String, default: "INR" },
    subtotal: Number,
    shippingMethod: String,
    shippingCost: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode: String,
    // Richer coupon snapshot than couponCode alone (rule #49) — so a later
    // change to the coupon's own config can't retroactively make an old
    // order's discount look unexplained.
    couponSnapshot: {
      code: String,
      discountAmount: Number,
    },
    // Phase 11 — which Promotion(s) actually produced discountAmount, frozen
    // at order-creation time. A promotion's name/rules can change (or the
    // promotion can be archived) tomorrow without altering what this order
    // historically shows — same immutability rule as couponSnapshot.
    // Explicit sub-schema, not a bare object literal — see Checkout.js's
    // appliedPromotions comment for why a field named `type` inside an
    // inline array-of-objects definition needs this to avoid Mongoose
    // misreading the whole object as the array's own type descriptor.
    promotionSnapshots: [
      new mongoose.Schema(
        {
          promotion: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
          name: String,
          type: String,
          discountAmount: Number,
          freeShipping: Boolean,
          redemption: { type: mongoose.Schema.Types.ObjectId, ref: "CouponRedemption" },
        },
        { _id: false }
      ),
    ],
    totalAmount: { type: Number, required: true }, // the grand total
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },

    // Three separate dimensions (rules #18/#19) — never collapsed into one
    // field. `status` is the overall business/commercial lifecycle (see
    // utils/orderStateMachine.js for the explicit transition graph);
    // `paymentStatus` mirrors Payment.status (Phase 8) for cheap reads
    // without a join; `fulfillmentStatus` is the shipping-relevant subset,
    // ready for a dedicated Fulfillment/Shipment domain later without this
    // field needing to move.
    status: {
      type: String,
      enum: [
        "pending_payment",
        "payment_processing",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "return_requested",
        "returned",
        "refunded",
      ],
      default: "pending_payment",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "processing", "succeeded", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
    fulfillmentStatus: {
      type: String,
      // partially_shipped/partially_delivered added in Phase 10 — reached
      // when an order has more than one Shipment and they're not all at the
      // same stage (see services/orderFulfillmentSync.js). Additive to
      // Phase 9's enum, not a rename, so no migration is needed for this one.
      enum: [
        "not_started", "processing", "packed", "partially_shipped", "shipped",
        "out_for_delivery", "partially_delivered", "delivered",
      ],
      default: "not_started",
    },

    // Order-creation idempotency (rule #22) — a second createOrderFromItems
    // call with the same key returns the existing order instead of creating
    // a duplicate. Covers the legacy direct /orders path; the Checkout path
    // is already protected by Checkout's own atomic claim (Phase 7) and this
    // is a second, independent layer for it too.
    idempotencyKey: { type: String, unique: true, sparse: true },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ fulfillmentStatus: 1 });

export default mongoose.model("Order", orderSchema);
