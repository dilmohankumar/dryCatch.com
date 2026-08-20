import mongoose from "mongoose";

// The append-only audit timeline for one order — "who did what, when, why"
// for every meaningful transition. Never updated or deleted once written;
// this is the historical record the order detail page's timeline UI reads
// from, and what support/admin uses to answer "what happened to this order."
const orderEventSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    type: { type: String, required: true }, // ORDER_CREATED | PAYMENT_CONFIRMED | ORDER_CANCELLED | ORDER_STATUS_CHANGED | ...
    fromStatus: String,
    toStatus: String,
    message: String,
    actorType: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", "STAFF", "SYSTEM", "PAYMENT_PROVIDER", "WAREHOUSE", "DELIVERY_SYSTEM"],
      required: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // absent for SYSTEM/PAYMENT_PROVIDER
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

orderEventSchema.index({ order: 1, createdAt: 1 });

export default mongoose.model("OrderEvent", orderEventSchema);
