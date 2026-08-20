import mongoose from "mongoose";

// Deliberately minimal (rule #27: "do not create a complex warehouse system
// unless required") — but its existence as a real referenced model, not a
// free-text string on Fulfillment, is what lets multi-warehouse fulfillment
// (rule #28) slot in later without a schema change.
const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // e.g. "MUM-01"
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("Warehouse", warehouseSchema);
