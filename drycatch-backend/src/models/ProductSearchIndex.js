import mongoose from "mongoose";

// The read-optimized search projection (rule #3/#4/#5) — Product remains
// the source of truth; this collection is a denormalized copy shaped for
// discovery, kept in sync by indexingService.js. Never write here directly
// from anywhere else; never read Product directly for search — the whole
// point is that a real search engine (OpenSearch) could replace this
// collection later without touching searchService's calling code, since
// mongoSearchProvider.js is the only thing that queries it.
const productSearchIndexSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    shortDescription: String,
    description: String,
    category: String, // denormalized name, not just an id — facets need a display label
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    categoryPath: String, // "Nuts & Seeds > Cashews" — rule #37
    tags: [String],
    keywords: [String], // admin/derived search keywords, distinct from tags
    sku: [String], // every variant SKU, for exact SKU search (rule #100)

    variants: [
      {
        variantId: mongoose.Schema.Types.ObjectId,
        label: String, // e.g. "250g"
        price: Number,
        sku: String,
        inStock: Boolean,
      },
    ],
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} }, // flattened for faceting

    price: Number, // display/default price
    minPrice: Number,
    maxPrice: Number,
    currency: { type: String, default: "INR" },

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },

    inventoryStatus: { type: String, enum: ["in_stock", "low_stock", "out_of_stock"], default: "in_stock" },

    // Popularity/sales signals (rule #6/#40/#108) — normalized, coarse
    // counters rather than a live analytics join; refreshed by
    // reindexAll/reconciliation, not on every single sale.
    popularity: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true }, // Product.status === "active"
    isPublished: { type: Boolean, default: true }, // Product.visibility === "public"

    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Mongo's own full-text index — the MVP retrieval mechanism (rule #74:
// "implement database/basic provider for development" before a real
// engine). Weighted per rule #7/#8: name counts far more than description.
productSearchIndexSchema.index(
  { name: "text", shortDescription: "text", description: "text", tags: "text", keywords: "text", category: "text" },
  { weights: { name: 10, tags: 4, keywords: 4, category: 6, shortDescription: 2, description: 1 }, name: "product_search_text" }
);
// Facet/filter fields — exact-match, not analyzed text (rule #34/#135:
// "keyword fields for aggregation, not analyzed text").
productSearchIndexSchema.index({ categoryId: 1 });
productSearchIndexSchema.index({ price: 1 });
productSearchIndexSchema.index({ rating: -1 });
productSearchIndexSchema.index({ isActive: 1, isPublished: 1 });
productSearchIndexSchema.index({ sku: 1 });

export default mongoose.model("ProductSearchIndex", productSearchIndexSchema);
