import mongoose from "mongoose";

// Behavioral data (rule #133: keep analytics separate from the
// transactional DB and the search index) — append-only. Never stores
// email/phone/payment info (rule #117); sessionId/customerId only.
const searchEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["performed", "clicked", "no_results", "add_to_cart"], required: true },
    query: String,
    normalizedQuery: String,
    resultCount: Number,
    filters: mongoose.Schema.Types.Mixed,
    sort: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // for "clicked"/"add_to_cart"
    position: Number, // rule #52/#55 — result position clicked
    sessionId: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

searchEventSchema.index({ type: 1, createdAt: -1 });
searchEventSchema.index({ normalizedQuery: 1, type: 1 });

export default mongoose.model("SearchEvent", searchEventSchema);
