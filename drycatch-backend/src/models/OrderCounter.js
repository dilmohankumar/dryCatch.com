import mongoose from "mongoose";

// Backs the human-readable order number (DC-2026-000123). One document per
// year, incremented via an atomic $inc — never "read the max order number,
// add 1, save," which races under concurrent order creation. Collision-safe
// by construction, not by relying on Date.now() uniqueness.
const orderCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "order_2026"
  seq: { type: Number, default: 0 },
});

export default mongoose.model("OrderCounter", orderCounterSchema);
