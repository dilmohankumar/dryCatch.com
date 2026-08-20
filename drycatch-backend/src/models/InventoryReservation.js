import mongoose from "mongoose";

// A temporary hold on stock between "checkout started" and "payment
// resolved" — never a permanent deduction (see services/inventoryService.js
// for why add-to-cart does NOT create one of these).
const reservationSchema = new mongoose.Schema(
  {
    variant: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryLocation", required: true },
    quantity: { type: Number, required: true, min: 1 },
    // What this reservation is for — an order attempt today, could be a
    // different reference type later (e.g. a manual hold).
    referenceType: { type: String, required: true, default: "order" },
    referenceId: { type: String, required: true },
    status: { type: String, enum: ["active", "committed", "released", "expired"], default: "active" },
    expiresAt: { type: Date, required: true },
    releasedAt: Date,
  },
  { timestamps: true }
);

// The idempotency guard (rule 22/54/55): the same (referenceType,
// referenceId, variant) can never produce two reservations, so a duplicated
// checkout request can't double-reserve stock.
reservationSchema.index({ referenceType: 1, referenceId: 1, variant: 1 }, { unique: true });
reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ variant: 1, location: 1 });

export default mongoose.model("InventoryReservation", reservationSchema);
