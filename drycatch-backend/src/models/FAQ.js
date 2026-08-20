import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true }, // sanitized plain/structured text, same rule as reviews (Phase 12)
    category: String, // e.g. "Shipping", "Returns" — free text, not a separate collection (rule #37 doesn't require normalization at this scale)
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ status: 1 });

export default mongoose.model("FAQ", faqSchema);
