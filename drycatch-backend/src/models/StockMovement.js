import mongoose from "mongoose";

// The audit ledger — every inventory change, ever, with why. Nothing in
// inventoryService.js mutates Inventory without also writing one of these
// in the same operation (see reserveStock/adjustStock etc.).
const MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "MANUAL_ADJUSTMENT",
  "SALE",
  "RETURN",
  "DAMAGE",
  "RESERVATION",
  "RELEASE",
];

const movementSchema = new mongoose.Schema(
  {
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryLocation", required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    // Signed: +100 for a receipt, -1 for a sale/reservation, +1 for a release/return.
    quantity: { type: Number, required: true },
    referenceType: String,
    referenceId: String,
    reason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Idempotency for movements tied to a specific reference+type (e.g. exactly
// one SALE movement per order per variant, even if commit is retried).
movementSchema.index(
  { referenceType: 1, referenceId: 1, variant: 1, type: 1 },
  { unique: true, partialFilterExpression: { referenceId: { $exists: true } } }
);
movementSchema.index({ variant: 1, location: 1, createdAt: -1 });
movementSchema.index({ createdAt: -1 });

export const MOVEMENT_TYPES_LIST = MOVEMENT_TYPES;
export default mongoose.model("StockMovement", movementSchema);
