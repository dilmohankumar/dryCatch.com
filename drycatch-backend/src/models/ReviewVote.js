import mongoose from "mongoose";

// One vote per (review, customer) — changing Helpful -> Not Helpful UPDATES
// this document (rule #32), never creates a second one. The unique index
// is the actual constraint; reviewVoteService's upsert relies on it.
const reviewVoteSchema = new mongoose.Schema(
  {
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vote: { type: String, enum: ["helpful", "not_helpful"], required: true },
  },
  { timestamps: true }
);

reviewVoteSchema.index({ review: 1, user: 1 }, { unique: true });

export default mongoose.model("ReviewVote", reviewVoteSchema);
