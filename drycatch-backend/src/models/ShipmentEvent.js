import mongoose from "mongoose";

// Append-only tracking history — never overwritten (rule #38). `eventTime`
// (when the carrier says it happened) is kept separate from `createdAt`
// (when we recorded it) since carrier events can arrive late (rule #91).
const shipmentEventSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment", required: true },
    status: { type: String, required: true }, // normalized internal status, e.g. IN_TRANSIT
    location: String,
    description: String,
    eventTime: { type: Date, required: true },
    source: { type: String, enum: ["carrier_webhook", "carrier_poll", "admin", "system"], default: "carrier_webhook" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

shipmentEventSchema.index({ shipment: 1, eventTime: 1 });

export default mongoose.model("ShipmentEvent", shipmentEventSchema);
