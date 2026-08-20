import mongoose from "mongoose";

// Search merchandising (rule #43-45): pin/boost/bury a product for a
// specific query, or redirect the query entirely — admin-configured, never
// a hard-coded "product X is always first" in application code. Matched
// case-insensitively against the normalized query in searchService.js.
const searchRuleSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, lowercase: true, trim: true },
    action: { type: String, enum: ["pin", "boost", "bury", "redirect"], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // pin/boost/bury target
    redirectUrl: String, // redirect target
    priority: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    startAt: Date,
    endAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

searchRuleSchema.index({ query: 1, status: 1 });

export default mongoose.model("SearchRule", searchRuleSchema);
