import mongoose from "mongoose";

// "Which physical package went out, through which carrier." Tracking
// numbers, labels, and carrier state all live here — never on Order (rule
// #108) — because one order can produce many shipments (multi-warehouse,
// partial fulfillment, re-shipped replacements).
const shipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    fulfillment: { type: mongoose.Schema.Types.ObjectId, ref: "Fulfillment", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse" },

    carrier: { type: String, required: true }, // "mock" | "shiprocket" | "delhivery" — resolved via carrierFactory
    carrierShipmentId: String, // the carrier's own reference for this shipment/order
    trackingNumber: String,
    trackingUrl: String,

    status: {
      type: String,
      enum: [
        "created",
        "label_failed",
        "label_created",
        "ready_for_pickup",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "rto_initiated",
        "rto_in_transit",
        "rto_delivered",
        "cancelled",
      ],
      default: "created",
    },

    shippingMethod: String,
    // Separate customer-facing charge vs what the carrier actually costs
    // (rule #51/#85) — never the same field, so a future profitability
    // report can compare them without re-deriving one from the other.
    customerShippingCharge: { type: Number, default: 0 },
    carrierShippingCost: Number,

    labelUrl: String,
    labelGeneratedAt: Date,

    estimatedDeliveryFrom: Date,
    estimatedDeliveryTo: Date,

    shippedAt: Date,
    deliveredAt: Date,
    failureReason: String,

    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

shipmentSchema.index({ order: 1 });
shipmentSchema.index({ fulfillment: 1 });
shipmentSchema.index({ status: 1 });
// Tracking numbers are only unique WITHIN a carrier in reality (rule #80),
// which would suggest a compound {carrier, trackingNumber} index — but a
// compound SPARSE index only excludes a document when ALL of its fields
// are missing, and `carrier` is always set, so two shipments both missing
// `trackingNumber` (the normal state before label generation) would still
// collide as {carrier:"mock", trackingNumber:null} (the exact bug found and
// fixed on Payment/Refund in Phase 8). Single-field sparse indexes here are
// technically a stricter constraint (global uniqueness, not per-carrier),
// but that's the safe tradeoff until multiple carriers are actually live.
shipmentSchema.index({ trackingNumber: 1 }, { unique: true, sparse: true });
shipmentSchema.index({ carrierShipmentId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Shipment", shipmentSchema);
