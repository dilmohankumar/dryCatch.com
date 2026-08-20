import mongoose from "mongoose";

// Links a Fulfillment back to the specific line(s) of the Order it's
// preparing. Order.items are embedded subdocuments without their own _id
// (Phase 7/9), so the connection back to "which order line is this" is by
// `variant` within the order rather than a subdocument foreign key —
// sufficient since an order cannot contain the same variant on two separate
// lines (cart/checkout already collapse duplicates).
const fulfillmentItemSchema = new mongoose.Schema(
  {
    fulfillment: { type: mongoose.Schema.Types.ObjectId, ref: "Fulfillment", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    sku: String,
    name: String,
    quantity: { type: Number, required: true }, // ordered quantity assigned to this fulfillment
    fulfilledQuantity: { type: Number, default: 0 }, // actually packed/shipped so far
  },
  { timestamps: true }
);

fulfillmentItemSchema.index({ fulfillment: 1 });

export default mongoose.model("FulfillmentItem", fulfillmentItemSchema);
