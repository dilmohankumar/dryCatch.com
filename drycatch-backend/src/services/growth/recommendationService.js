import mongoose from "mongoose";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import { cached } from "../../utils/analyticsCache.js";

// Phase 24 — deterministic, rule-based recommendations (rule #15: "start
// with deterministic rules... do not immediately build a complex AI
// system without enough data"). LEVEL 1 (same category/tags) and the
// "frequently bought together" LEVEL 2 strategy — LEVEL 3/4 (trending,
// personalized-by-behavior) are documented as the natural next step once
// enough order/event volume exists to make them meaningful, not built
// speculatively against a near-empty catalog.

// LEVEL 1 — same category, excluding the product itself, in-stock/public only.
export async function getRelatedProducts(productId, { limit = 8 } = {}) {
  const product = await Product.findById(productId, "category tags");
  if (!product) return [];

  const cap = Math.min(Number(limit) || 8, 20);
  const byCategory = product.category
    ? await Product.find(
        { _id: { $ne: productId }, category: product.category, status: "active", visibility: "public" },
        "name slug price mrp media rating reviewsCount"
      ).limit(cap)
    : [];

  if (byCategory.length >= cap || !product.tags?.length) return byCategory;

  // Top up with tag-overlap matches if the category alone didn't fill the
  // requested count (e.g. a niche category with few siblings).
  const byTags = await Product.find(
    { _id: { $ne: productId, $nin: byCategory.map((p) => p._id) }, tags: { $in: product.tags }, status: "active", visibility: "public" },
    "name slug price mrp media rating reviewsCount"
  ).limit(cap - byCategory.length);

  return [...byCategory, ...byTags];
}

// LEVEL 2 — "customers who bought this also bought" (rule #17), computed
// from real order history via aggregation, not a separately-maintained
// association table. Cached briefly (this project's honest in-process
// TTL cache from Phase 17/19 — no Redis exists) since it's a real
// aggregation over the Order collection, not a cheap indexed lookup.
const MIN_COOCCURRENCE = 2; // rule #17 "minimum sample size" — a single shared order isn't a pattern
const CACHE_TTL_MS = 10 * 60_000;

export async function getFrequentlyBoughtTogether(productId, { limit = 6 } = {}) {
  const cap = Math.min(Number(limit) || 6, 20);
  return cached(`fbt:${productId}:${cap}`, CACHE_TTL_MS, async () => {
    const productObjectId = new mongoose.Types.ObjectId(String(productId));
    const rows = await Order.aggregate([
      { $match: { "items.product": productObjectId, status: { $nin: ["cancelled", "pending_payment"] } } },
      { $unwind: "$items" },
      { $match: { "items.product": { $ne: productObjectId } } },
      { $group: { _id: "$items.product", coOccurrences: { $sum: 1 } } },
      { $match: { coOccurrences: { $gte: MIN_COOCCURRENCE } } },
      { $sort: { coOccurrences: -1 } },
      { $limit: cap },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $match: { "product.status": "active", "product.visibility": "public" } },
      { $project: { _id: "$product._id", name: "$product.name", slug: "$product.slug", price: "$product.price", mrp: "$product.mrp", media: "$product.media", rating: "$product.rating", reviewsCount: "$product.reviewsCount", coOccurrences: 1 } },
    ]);
    return rows;
  });
}

// Best-sellers fallback (rule #15 "popular products") — used when a
// product has too few/no co-occurrence data yet, so a recommendation
// slot is never just empty.
export async function getPopularProducts({ limit = 8, excludeProductId } = {}) {
  const cap = Math.min(Number(limit) || 8, 20);
  const filter = { status: "active", visibility: "public" };
  if (excludeProductId) filter._id = { $ne: excludeProductId };
  return Product.find(filter, "name slug price mrp media rating reviewsCount").sort({ reviewsCount: -1, rating: -1 }).limit(cap);
}
