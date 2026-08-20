import mongoose from "mongoose";

// The identity of a stock record is variant+location, never product alone
// (Product does not own stock — see docs/database.md). `available` is
// deliberately NOT a stored field: persisting a derived number invites drift
// the moment on-hand/reserved change without it, so it's always computed
// (quantityOnHand - quantityReserved) at read time via the virtual below.
const inventorySchema = new mongoose.Schema(
  {
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryLocation", required: true },
    quantityOnHand: { type: Number, required: true, default: 0, min: 0 },
    quantityReserved: { type: Number, required: true, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

inventorySchema.virtual("quantityAvailable").get(function () {
  return this.quantityOnHand - this.quantityReserved;
});
inventorySchema.set("toJSON", { virtuals: true });
inventorySchema.set("toObject", { virtuals: true });

// The uniqueness rule the whole system depends on — one stock record per
// variant per location, enforced by MongoDB, not just app-level checking.
inventorySchema.index({ variant: 1, location: 1 }, { unique: true });
inventorySchema.index({ status: 1 });

export default mongoose.model("Inventory", inventorySchema);
