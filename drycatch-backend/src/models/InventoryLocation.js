import mongoose from "mongoose";

// Deliberately minimal — one location ("MAIN") is all DryCatch needs today,
// but every inventory record keys off {variant, location} from day one so
// adding a second warehouse later is a new document, not a schema change.
const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryLocation", locationSchema);
