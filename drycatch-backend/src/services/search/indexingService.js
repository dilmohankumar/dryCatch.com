import Product from "../../models/Product.js";
import ProductVariant from "../../models/ProductVariant.js";
import Category from "../../models/Category.js";
import Inventory from "../../models/Inventory.js";
import { getSearchProvider } from "./providers/searchProviderFactory.js";

// The only place that knows how to turn Catalog/Variant/Inventory/Review
// data into a search document (rule #56) — indexProduct/updateProduct/
// deleteProduct/bulkIndex/reindexAll. Called synchronously from
// productService/variantService/ratingAggregationService right now (rule
// #64 calls for an event queue + worker; no queue infrastructure exists in
// this project — same honest limitation noted since Phase 5's background
// jobs — so this is a direct call, not a queued one, documented as the gap
// a real deployment would close).
async function buildCategoryPath(categoryId) {
  const parts = [];
  let current = categoryId ? await Category.findById(categoryId) : null;
  while (current) {
    parts.unshift(current.name);
    current = current.parent ? await Category.findById(current.parent) : null;
  }
  return { name: parts[parts.length - 1], path: parts.join(" > ") };
}

async function buildSearchDocument(productId) {
  const product = await Product.findById(productId);
  if (!product) return null;

  const variants = await ProductVariant.find({ product: productId, status: { $ne: "archived" } });
  const inventories = variants.length
    ? await Inventory.find({ variant: { $in: variants.map((v) => v._id) } })
    : [];
  const inventoryByVariant = new Map(inventories.map((i) => [String(i.variant), i]));

  const { name: categoryName, path: categoryPath } = await buildCategoryPath(product.category);

  const variantDocs = variants.map((v) => {
    const inv = inventoryByVariant.get(String(v._id));
    const available = inv ? inv.quantityOnHand - inv.quantityReserved : 1;
    return {
      variantId: v._id,
      label: v.weight?.value ? `${v.weight.value}${v.weight.unit}` : undefined,
      price: v.price,
      sku: v.sku,
      inStock: available > 0,
    };
  });

  const prices = variantDocs.map((v) => v.price).filter((p) => p != null);
  const minPrice = prices.length ? Math.min(...prices) : product.price;
  const maxPrice = prices.length ? Math.max(...prices) : product.price;
  const anyInStock = variantDocs.length ? variantDocs.some((v) => v.inStock) : true;
  const allOutOfStock = variantDocs.length ? variantDocs.every((v) => !v.inStock) : false;

  return {
    product: product._id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    category: categoryName,
    categoryId: product.category,
    categoryPath,
    tags: product.tags || [],
    keywords: product.tags || [], // no separate admin keyword field exists yet — tags double as keywords
    sku: variantDocs.map((v) => v.sku).filter(Boolean),
    variants: variantDocs,
    attributes: Object.fromEntries(variants.flatMap((v) => Array.from(v.attributes?.entries?.() || []))),
    price: product.price,
    minPrice,
    maxPrice,
    currency: "INR",
    rating: product.rating || 0,
    reviewCount: product.reviewsCount || 0,
    inventoryStatus: allOutOfStock ? "out_of_stock" : anyInStock ? "in_stock" : "low_stock",
    popularity: product.reviewsCount || 0, // coarse proxy signal (rule #6) — no click/view analytics feed this yet
    salesCount: 0, // would come from Order aggregation; not wired this phase (see docs/search.md)
    isActive: product.status === "active",
    isPublished: product.visibility === "public",
    featured: Boolean(product.featured),
  };
}

export async function indexProduct(productId) {
  const doc = await buildSearchDocument(productId);
  const provider = getSearchProvider();
  if (!doc) { await provider.remove(productId); return; }
  await provider.index(doc);
}

export const updateProductIndex = indexProduct; // a partial rebuild is still cheap at this catalog size — no separate "patch" path needed
export const deleteProductIndex = (productId) => getSearchProvider().remove(productId);

export async function bulkIndex(productIds) {
  const docs = (await Promise.all(productIds.map(buildSearchDocument))).filter(Boolean);
  await getSearchProvider().bulkIndex(docs);
  return { count: docs.length };
}

// Full reindex (rule #69) — collapses to "clear -> rebuild everything" for
// the Mongo provider (no alias/version concept there); a real OpenSearch
// provider is where the new-index/bulk-index/validate/alias-swap sequence
// would actually matter.
export async function reindexAll() {
  const provider = getSearchProvider();
  await provider.reindexAll();
  const productIds = await Product.find({}, "_id").lean().then((rows) => rows.map((r) => r._id));
  return bulkIndex(productIds);
}

// Reconciliation (rule #126/#127) — compares DB counts against the index
// and repairs drift; exposed as an admin-triggered endpoint since no job
// scheduler exists in this project to run it automatically.
export async function reconcile() {
  const ProductSearchIndex = (await import("../../models/ProductSearchIndex.js")).default;
  const dbProductIds = new Set((await Product.find({}, "_id").lean()).map((p) => String(p._id)));
  const indexedIds = new Set((await ProductSearchIndex.find({}, "product").lean()).map((d) => String(d.product)));

  const missing = [...dbProductIds].filter((id) => !indexedIds.has(id));
  const orphaned = [...indexedIds].filter((id) => !dbProductIds.has(id));

  for (const id of missing) await indexProduct(id);
  for (const id of orphaned) await deleteProductIndex(id);

  return { missingRepaired: missing.length, orphanedRemoved: orphaned.length };
}
