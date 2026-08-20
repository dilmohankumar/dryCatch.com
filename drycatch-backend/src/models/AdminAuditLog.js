import mongoose from "mongoose";

// The cross-cutting admin audit trail (rule #78-81, #140-141) — separate
// from domain-specific event logs that already exist (OrderEvent from
// Phase 9, ShipmentEvent from Phase 10) because THOSE answer "what happened
// to this order/shipment," while this answers "what did this admin do,"
// across every module, in one searchable place. Append-only by convention
// — no update/delete route is ever built for this model (rule #80).
const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "PRODUCT_UPDATED", "ORDER_REFUNDED", "ROLE_CHANGED"
    entityType: String, // "Product" | "Order" | "User" | "Role" | ...
    entityId: mongoose.Schema.Types.ObjectId,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    ip: String,
    requestId: String,
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ actor: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.model("AdminAuditLog", adminAuditLogSchema);
