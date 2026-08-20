import mongoose from "mongoose";

const redirectSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, unique: true }, // e.g. "/old-gift-guide"
    destination: { type: String, required: true },
    statusCode: { type: Number, enum: [301, 302], default: 301 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Redirect", redirectSchema);
