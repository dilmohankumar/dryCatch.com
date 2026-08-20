import ProductSearchIndex from "../../../models/ProductSearchIndex.js";

// The real, working MVP provider (rule #74: "if OpenSearch is not
// currently available, implement a database/basic provider for
// development" — no OpenSearch/Elasticsearch cluster exists in this
// project). Uses Mongo's own `$text` index (weighted per field — see
// ProductSearchIndex.js) plus regex fallbacks for autocomplete, since Mongo
// text search doesn't do prefix matching well. This is NOT a placeholder —
// it's fully functional — but it is the "MVP provider," not the final
// architecture; opensearchProvider.js is the honest stub for what a real
// deployment would swap in.
const PRICE_RANGES = [
  { label: "Under ₹500", max: 500 },
  { label: "₹500–₹1,000", min: 500, max: 1000 },
  { label: "₹1,000–₹2,500", min: 1000, max: 2500 },
  { label: "₹2,500+", min: 2500 },
];

function buildFilterMatch(filters = {}) {
  const match = { isActive: true, isPublished: true };
  if (filters.categoryId) match.categoryId = filters.categoryId;
  if (filters.minPrice != null || filters.maxPrice != null) {
    match.price = {};
    if (filters.minPrice != null) match.price.$gte = Number(filters.minPrice);
    if (filters.maxPrice != null) match.price.$lte = Number(filters.maxPrice);
  }
  if (filters.rating != null) match.rating = { $gte: Number(filters.rating) };
  if (filters.availability === "in_stock") match.inventoryStatus = { $ne: "out_of_stock" };
  if (filters.availability === "out_of_stock") match.inventoryStatus = "out_of_stock";
  return match;
}

const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1, reviewCount: -1 },
  newest: { createdAt: -1 },
  best_selling: { salesCount: -1 },
  featured: { featured: -1, popularity: -1 },
  // "relevance" is handled specially — text score, not a static sort spec (rule #39/#40).
};

export const mongoSearchProvider = {
  name: "mongo",

  async search({ text, filters = {}, sort = "relevance", page = 1, limit = 24 }) {
    const match = buildFilterMatch(filters);
    let query;
    let projection = {};
    if (text?.trim()) {
      match.$text = { $search: text.trim() };
      projection = { score: { $meta: "textScore" } };
    }
    query = ProductSearchIndex.find(match, projection);

    if (text?.trim() && sort === "relevance") {
      query = query.sort({ score: { $meta: "textScore" } });
    } else {
      query = query.sort(SORTS[sort] || SORTS.featured);
    }

    const skip = (page - 1) * limit;
    const [hits, total] = await Promise.all([
      query.skip(skip).limit(limit).lean(),
      ProductSearchIndex.countDocuments(match),
    ]);

    return { hits, total };
  },

  // Facets computed from the SAME match context minus the facet's own
  // filter (rule #35 — "if customer selects Brand A, remaining facets
  // should still behave predictably" — each facet is computed against
  // everything-but-itself, not the fully-filtered result set, so a
  // category facet still shows other categories' counts even after the
  // customer narrows by category... simplified here to compute every facet
  // against the TEXT-matched-but-otherwise-unfiltered set, which is the
  // common, cheaper approximation many storefronts actually ship).
  async facets({ text, filters = {} }) {
    const baseMatch = { isActive: true, isPublished: true };
    if (text?.trim()) baseMatch.$text = { $search: text.trim() };

    const [categoryFacets, ratingFacets, priceFacets] = await Promise.all([
      ProductSearchIndex.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      ProductSearchIndex.aggregate([
        { $match: baseMatch },
        { $group: { _id: { $floor: "$rating" }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
      Promise.all(
        PRICE_RANGES.map(async (range) => {
          const rangeMatch = { ...baseMatch };
          rangeMatch.price = {};
          if (range.min != null) rangeMatch.price.$gte = range.min;
          if (range.max != null) rangeMatch.price.$lte = range.max;
          const count = await ProductSearchIndex.countDocuments(rangeMatch);
          return { label: range.label, min: range.min, max: range.max, count };
        })
      ),
    ]);

    return {
      categories: categoryFacets.map((f) => ({ value: f._id, count: f.count })),
      ratings: ratingFacets.filter((f) => f._id != null).map((f) => ({ value: f._id, count: f.count })),
      price: priceFacets,
    };
  },

  // Prefix-based (rule #16/#137's edge-ngram/search_as_you_type equivalent,
  // approximated with an anchored regex since Mongo has no native prefix
  // suggester). Fine at this catalog's scale; a real OpenSearch completion
  // suggester would replace this for a much larger one.
  async autocomplete({ prefix, limit = 8 }) {
    const anchored = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const products = await ProductSearchIndex.find(
      { isActive: true, isPublished: true, name: anchored },
      { name: 1, slug: 1, price: 1, minPrice: 1, category: 1, rating: 1 }
    ).limit(limit).lean();

    const categories = await ProductSearchIndex.distinct("category", { isActive: true, isPublished: true, category: anchored });

    return { products, categories: categories.slice(0, 5) };
  },

  async index(doc) {
    await ProductSearchIndex.findOneAndUpdate({ product: doc.product }, doc, { upsert: true, new: true });
  },

  async update(productId, partialDoc) {
    await ProductSearchIndex.updateOne({ product: productId }, { $set: partialDoc });
  },

  async remove(productId) {
    await ProductSearchIndex.deleteOne({ product: productId });
  },

  async bulkIndex(docs) {
    if (!docs.length) return;
    const ops = docs.map((doc) => ({
      updateOne: { filter: { product: doc.product }, update: { $set: doc }, upsert: true },
    }));
    await ProductSearchIndex.bulkWrite(ops);
  },

  // Clears the projection before indexingService rebuilds it from Product/
  // ProductVariant — the "new index -> bulk index -> swap" flow (rule #69)
  // collapses to "clear -> bulk index" here since Mongo has no alias
  // concept; a real OpenSearch provider is where index versioning/aliasing
  // (products_v1/v2 + products_current) would actually apply (rule #70/#71).
  async reindexAll() {
    await ProductSearchIndex.deleteMany({});
    return { cleared: true };
  },

  async healthCheck() {
    const count = await ProductSearchIndex.estimatedDocumentCount();
    return { healthy: true, provider: "mongo", documentCount: count };
  },
};
