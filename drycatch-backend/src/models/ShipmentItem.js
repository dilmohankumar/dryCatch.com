import mongoose from "mongoose";

// Why this can't just be `orderItem.shipmentId`: one order item (e.g.
// "Product A x 3") can be split across two shipments ("A x 1" in Shipment
// 1, "A x 2" in Shipment 2) — the quantity actually going out in THIS
// shipment has to be tracked independently of both the order line and the
// fulfillment line.
const shipmentItemSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment", required: true },
    fulfillmentItem: { type: mongoose.Schema.Types.ObjectId, ref: "FulfillmentItem", required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
    sku: String,
    name: String,
    quantity: { type: Number, required: true },
  },
  { timestamps: true }
);

shipmentItemSchema.index({ shipment: 1 });

export default mongoose.model("ShipmentItem", shipmentItemSchema);
