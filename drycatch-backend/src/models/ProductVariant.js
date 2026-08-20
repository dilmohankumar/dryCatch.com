import mongoose from "mongoose";

const UNITS = ["g", "kg", "ml", "l", "piece", "pack"];

const mediaSchema = new mongoose.Schema(
  { type: { type: String, enum: ["image", "video"], default: "image" }, url: { type: String, required: true }, alt: String, sortOrder: { type: Number, default: 0 } },
  { _id: false }
);

// The purchasable unit. Product answers "what is this"; Variant answers
// "which exact configuration, at which price, under which SKU". See
// docs/database.md for the full Product → Variant → Pricing → Inventory
// boundary this establishes.
const variantSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // Globally unique across the whole catalog, not just within a product —
    // stable once referenced by a cart/order (see services/variantService.js
    // for why updates never let sku be silently overwritten).
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },

    // Weight gets a structured value+unit (not just a display string) since
    // it's DryCatch's primary purchasable dimension today and this unlocks
    // price-per-kg/shipping/filtering later without a migration.
    weight: {
      value: Number,
      unit: { type: String, enum: UNITS },
    },
    // Any other dimension (packaging, flavor, size...) stays a flexible
    // Map rather than a hardcoded column per possible attribute.
    attributes: { type: Map, of: String, default: {} },

    // Computed from product + weight + attributes (see variantService) —
    // the DB-level guard against two variants representing the same
    // purchasable combination with different SKUs.
    combinationKey: { type: String, required: true },

    price: { type: Number, required: true },
    mrp: Number,
    discountPct: { type: Number, default: 0 },

    status: { type: String, enum: ["draft", "active", "inactive", "archived"], default: "draft" },
    visibility: { type: String, enum: ["public", "hidden"], default: "public" },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    media: [mediaSchema],
  },
  { timestamps: true }
);

variantSchema.pre("save", function (next) {
  this.discountPct = this.mrp && this.mrp > this.price ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;
  next();
});

variantSchema.index({ product: 1, status: 1 });
variantSchema.index({ product: 1, sortOrder: 1 });
variantSchema.index({ product: 1, combinationKey: 1 }, { unique: true });

export const VARIANT_UNITS = UNITS;
export default mongoose.model("ProductVariant", variantSchema);
