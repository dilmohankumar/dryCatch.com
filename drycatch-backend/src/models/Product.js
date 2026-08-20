import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video"], default: "image" },
    url: { type: String, required: true },
    alt: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    keywords: [String],
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // Phase 25 — every tenant-owned document carries this. Nullable only
    // during the migration window (scripts/migrateAddTenantId.js backfills
    // it for every pre-Phase-25 row); every NEW write goes through
    // productService, which always sets it from req.tenant, never from
    // client input (rule #11/#72).
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    name: { type: String, required: true, trim: true },
    // Stable, URL-safe identity distinct from _id — see services/productService.js
    // for generation/uniqueness. Never derive routing/lookups from `name` directly.
    // Phase 25 — uniqueness is now PER TENANT (rule #14): "almond" can
    // exist as a slug for two different tenants. The bare field is no
    // longer globally unique; see the compound index below.
    slug: { type: String, required: true, lowercase: true, trim: true },

    // ACTIVE/DRAFT/ARCHIVED is the product lifecycle; visibility is a separate
    // merchandising concern (e.g. an ACTIVE product can still be HIDDEN from
    // public listings while still purchasable via a direct/shared link).
    status: { type: String, enum: ["draft", "active", "inactive", "archived"], default: "draft" },
    visibility: { type: String, enum: ["public", "hidden"], default: "public" },

    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    collections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Collection" }],
    tags: [{ type: String, trim: true, lowercase: true }],
    // Free-form structured attributes (species, preparation, cut, etc.) — a
    // Map keeps this queryable (attributes.origin) without a hardcoded column
    // per attribute, per the "don't hardcode dozens of columns" guidance.
    attributes: { type: Map, of: String, default: {} },

    origin: String,
    originType: String,
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    weight: String,
    price: { type: Number, required: true },
    mrp: Number,
    // Phase 12 — the denormalized rating aggregate (rule #21-23): never
    // recomputed by scanning every Review on a product-page request.
    // `rating`/`reviewsCount` are kept as the existing pre-Phase-12 fields
    // (average, count) for backward compatibility; `ratingSum` is the
    // internal running total that makes the average an O(1) division
    // rather than a full re-aggregation, updated only via atomic $inc
    // deltas in ratingAggregationService.js — never a blind overwrite.
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingDistribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
    verifiedReviewCount: { type: Number, default: 0 },
    photoReviewCount: { type: Number, default: 0 },
    // Derived, not client-writable — computed in the pre-save hook below so
    // "sort by discount" can be a real server-side sort instead of a
    // client-side one that only works within a single fetched page.
    discountPct: { type: Number, default: 0 },
    emoji: String,
    bg: String,
    howWePickTheBest: [String],
    howToUse: String,
    shelfLife: String,
    // Purchasable configurations live in the ProductVariant collection now
    // (see models/ProductVariant.js) — Product.price/mrp above remain only
    // as a display/search fallback (e.g. list-view "from" price before
    // variants load), never the source of truth for what a customer pays.
    media: [mediaSchema],
    // Legacy plain-URL slides, kept only so existing seeded/demo data with no
    // `media` entries still renders something — new writes should use `media`.
    slides: [String],
    seo: seoSchema,

    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  this.discountPct = this.mrp && this.mrp > this.price ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;
  next();
});

productSchema.index({ name: "text", shortDescription: "text", description: "text" });
productSchema.index({ status: 1, visibility: 1 });
productSchema.index({ category: 1 });
productSchema.index({ collections: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });
// Phase 19 — every public listing query (productService.buildListQuery)
// filters {status:"active", visibility:"public"} and, for a category page,
// adds {category}, sorted newest-first by default. The three separate
// single-field indexes above let Mongo use one of them and then sort/filter
// the rest in memory; this compound index covers the single most common
// customer-facing query path (category browse, default sort) end-to-end,
// including the sort, without an in-memory sort stage. Other sort orders
// (price/name/popularity) still rely on the simpler indexes above — adding
// a compound index per sort variant would be indexing every field (rule
// #34), not justified at this catalog's current scale.
productSchema.index({ status: 1, visibility: 1, category: 1, createdAt: -1 });
// Phase 25 — the tenant-scoped replacement for the old bare-unique slug
// index; every lookup-by-slug in productService now filters by tenant
// too, so this is also the index that query actually uses.
productSchema.index({ tenant: 1, slug: 1 }, { unique: true, partialFilterExpression: { tenant: { $type: "objectId" } } });
productSchema.index({ tenant: 1, status: 1, visibility: 1, createdAt: -1 });

export default mongoose.model("Product", productSchema);
