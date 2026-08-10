import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  { label: String, price: Number, mrp: Number },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    origin: String,
    originType: String,
    desc: String,
    description: String,
    weight: String,
    price: { type: Number, required: true },
    mrp: Number,
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    emoji: String,
    bg: String,
    howWePickTheBest: [String],
    howToUse: String,
    shelfLife: String,
    variants: [variantSchema],
    slides: [String],
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", desc: "text" });

export default mongoose.model("Product", productSchema);
