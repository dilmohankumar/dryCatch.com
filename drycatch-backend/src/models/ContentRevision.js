import mongoose from "mongoose";

// One generic revision model for both Page and BlogPost (rule #72/#73) —
// not a separate PageRevision/BlogRevision pair, since the shape ("a full
// snapshot of the content entity at a point in time, who made it, why")
// is identical for both. Append-only: restoring a revision creates a NEW
// revision (rule #74), it never deletes history.
const contentRevisionSchema = new mongoose.Schema(
  {
    contentType: { type: String, enum: ["page", "blog"], required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, // the full document at save time
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changeSummary: String,
  },
  { timestamps: true }
);

contentRevisionSchema.index({ contentType: 1, contentId: 1, version: -1 });

export default mongoose.model("ContentRevision", contentRevisionSchema);
