import mongoose from "mongoose";

// "What items are being prepared?" — deliberately separate from Shipment
// ("which physical package went out"). An order can have more than one
// Fulfillment (different warehouses, split by availability); each
// Fulfillment can eventually produce more than one Shipment too, though in
// this phase's default flow it's usually one Fulfillment -> one Shipment.
const fulfillmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" },
    status: {
      type: String,
      enum: ["pending", "allocated", "picking", "packing", "ready_to_ship", "shipped", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

fulfillmentSchema.index({ order: 1, status: 1 });
fulfillmentSchema.index({ warehouse: 1, status: 1 });

export default mongoose.model("Fulfillment", fulfillmentSchema);
