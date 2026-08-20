import mongoose from "mongoose";

const seoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    image: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    sortOrder: { type: Number, default: 0 },
    seo: seoSchema,
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });

export default mongoose.model("Category", categorySchema);
