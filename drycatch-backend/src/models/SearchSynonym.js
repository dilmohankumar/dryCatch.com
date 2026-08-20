import mongoose from "mongoose";

// Configurable, admin-managed — never hard-coded into application code
// (rule #13). "kaju" -> ["cashew", "cashew nuts"], applied at query time by
// synonymService.expandQuery, not baked into the index itself (so editing
// a synonym takes effect immediately, no reindex required).
const searchSynonymSchema = new mongoose.Schema(
  {
    term: { type: String, required: true, unique: true, lowercase: true, trim: true },
    synonyms: [{ type: String, lowercase: true, trim: true }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("SearchSynonym", searchSynonymSchema);
