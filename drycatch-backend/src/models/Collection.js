import mongoose from "mongoose";

// Collections are merchandising groupings (Best Sellers, New Arrivals) —
// distinct from Category, which is product taxonomy. A product can belong
// to many collections and still have just one category.
const seoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
  },
  { _id: false }
);

const collectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    image: String,
    status: { type: String, enum: ["active", "archived"], default: "active" },
    sortOrder: { type: Number, default: 0 },
    seo: seoSchema,
  },
  { timestamps: true }
);

collectionSchema.index({ status: 1 });

export default mongoose.model("Collection", collectionSchema);
