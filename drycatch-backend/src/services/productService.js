import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Collection from "../models/Collection.js";
import ProductVariant from "../models/ProductVariant.js";
import { generateUniqueSlug } from "../utils/slugify.js";
import * as redirectService from "./cms/redirectService.js";

const SORT_MAP = {
  featured: { featured: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  popularity: { reviewsCount: -1 },
  discount_desc: { discountPct: -1, createdAt: -1 },
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 24;

// Fields a caller (admin write) is allowed to set — the only defense against
// mass assignment. Never spread req.body into Product.create/update directly.
const WRITABLE_FIELDS = [
  "name",
  "category",
  "collections",
  "tags",
  "attributes",
  "origin",
  "originType",
  "shortDescription",
  "description",
  "weight",
  "price",
  "mrp",
  "emoji",
  "bg",
  "howWePickTheBest",
  "howToUse",
  "shelfLife",
  "media",
  "slides",
  "seo",
  "featured",
  "status",
  "visibility",
  "slug",
];

function pickWritable(body) {
  const out = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

// Only whitelisted query params ever reach a Mongo filter — nothing from
// req.query is ever passed through to .find() directly.
export async function buildListQuery(query = {}) {
  const filter = { status: "active", visibility: "public" };

  const splitList = (v) => String(v).split(",").map((s) => s.trim()).filter(Boolean);

  if (query.category) {
    const slugs = splitList(query.category);
    const cats = await Category.find({ slug: { $in: slugs }, status: "active" });
    // No match → filter yields zero results, not "ignore filter and return everything".
    filter.category = { $in: cats.map((c) => c._id) };
  }
  if (query.collection) {
    const slugs = splitList(query.collection);
    const cols = await Collection.find({ slug: { $in: slugs }, status: "active" });
    filter.collections = { $in: cols.map((c) => c._id) };
  }
  if (query.origin) {
    filter.originType = { $in: splitList(query.origin) };
  }
  if (query.tag) {
    filter.tags = { $in: splitList(query.tag).map((t) => t.toLowerCase()) };
  }
  if (query.featured === "true" || query.featured === true) {
    filter.featured = true;
  }
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.search) {
    filter.$text = { $search: String(query.search) };
  }

  const sort = SORT_MAP[query.sort] || SORT_MAP.featured;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));

  return { filter, sort, page, limit };
}

// Phase 25 — `tenantId` is a separate parameter, never read from `query`
// (which is client-controlled req.query) — it comes from `req.tenant`,
// resolved server-side from the Host header (rule #72). Omitted entirely
// by callers that haven't been retrofitted yet (pre-Phase-25 behavior,
// unchanged) — see docs/multi-tenant.md for which call sites still do this.
export async function listProducts(query = {}, tenantId = null) {
  const { filter, sort, page, limit } = await buildListQuery(query);
  if (tenantId) filter.tenant = tenantId;
  const skip = (page - 1) * limit;

  const [rawItems, totalItems] = await Promise.all([
    Product.find(filter).populate("category", "name slug").sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  // One extra query for the whole page (not one per card) — attaches each
  // product's default variant id so cards can Add-to-Cart directly without
  // an N+1 per-product variant fetch. Cart items reference variants, not
  // products, so listing pages need this to be cart-capable at all.
  const defaultVariants = await ProductVariant.find({
    product: { $in: rawItems.map((p) => p._id) },
    isDefault: true,
    status: "active",
  }).select("product");
  const defaultVariantByProduct = new Map(defaultVariants.map((v) => [String(v.product), String(v._id)]));

  const items = rawItems.map((p) => {
    const obj = p.toObject();
    obj.defaultVariantId = defaultVariantByProduct.get(String(p._id)) || null;
    return obj;
  });

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getPublicProductByIdOrSlug(idOrSlug, tenantId = null) {
  const isObjectId = /^[a-f0-9]{24}$/i.test(idOrSlug);
  const query = isObjectId
    ? { _id: idOrSlug, status: "active", visibility: "public" }
    : { slug: idOrSlug, status: "active", visibility: "public" };
  // Phase 25 — without this, a slug that happens to match another
  // tenant's product would leak it. When `tenantId` is omitted (a route
  // not yet retrofitted), behavior is unchanged from before this phase.
  if (tenantId) query.tenant = tenantId;
  const product = await Product.findOne(query).populate("category", "name slug");
  if (!product) return null;
  const defaultVariant = await ProductVariant.findOne({ product: product._id, isDefault: true, status: "active" }).select("_id");
  const obj = product.toObject();
  obj.defaultVariantId = defaultVariant?._id || null;
  return obj;
}

export async function createProduct(body, tenantId = null) {
  const data = pickWritable(body);
  if (!data.name) throw Object.assign(new Error("name is required"), { statusCode: 400 });
  if (data.price === undefined) throw Object.assign(new Error("price is required"), { statusCode: 400 });

  if (tenantId) data.tenant = tenantId;
  // Phase 25 — uniqueness is scoped to the same tenant this product is
  // being created in; a slug already taken by a DIFFERENT tenant is fine.
  data.slug = await generateUniqueSlug(data.name, (slug) => Product.exists(tenantId ? { slug, tenant: tenantId } : { slug }));
  const product = await Product.create(data);
  // Phase 13 — keep the search projection in sync synchronously (no queue
  // infrastructure exists in this project to do this asynchronously; see
  // docs/search.md). A failure here shouldn't fail product creation, so a
  // real deployment would push this onto a retryable queue instead.
  const { indexProduct } = await import("./search/indexingService.js");
  await indexProduct(product._id).catch(() => {});
  return product;
}

export async function updateProduct(id, body, actorId, tenantId = null) {
  const product = await Product.findById(id);
  if (!product) return null;
  // Phase 25 (rule #63 — IDOR/cross-tenant fetch-then-check, same pattern
  // orderController already uses for the user-ownership case): a product
  // ID is not secret, so existence alone must never be enough to edit it.
  if (tenantId && product.tenant && String(product.tenant) !== String(tenantId)) return null;

  const data = pickWritable(body);
  const previousSlug = product.slug;

  if (data.slug) {
    data.slug = String(data.slug).toLowerCase().trim();
    if (data.slug !== previousSlug) {
      const existing = await Product.exists(product.tenant ? { slug: data.slug, tenant: product.tenant } : { slug: data.slug });
      if (existing) throw Object.assign(new Error("A product with this slug already exists"), { statusCode: 409 });
    }
  }

  Object.assign(product, data);
  await product.save();

  // Phase 23 — a changed slug breaks every existing external link/bookmark/
  // search-engine index entry to the old URL unless something 301s it
  // forward (rule #12: "do not silently break old URLs when an admin
  // changes a product slug"). Reuses Phase 15's Redirect
  // model/service — the same mechanism already used for CMS page slug
  // changes — rather than building a second redirect system.
  if (data.slug && data.slug !== previousSlug) {
    await redirectService
      .createRedirect(actorId, { source: `/products/${previousSlug}`, destination: `/products/${data.slug}`, statusCode: 301 })
      .catch(() => {}); // a pre-existing redirect for that old path (e.g. from an even earlier rename) losing this one silently is an acceptable edge case, not worth failing the whole product update over
  }

  const { indexProduct } = await import("./search/indexingService.js");
  await indexProduct(product._id).catch(() => {});
  return product;
}

// Products are never hard-deleted once they exist — an order can reference
// one historically, and Order already snapshots name/price/variantLabel at
// purchase time, but the Product _id reference itself should keep resolving.
export async function archiveProduct(id) {
  const product = await Product.findById(id);
  if (!product) return null;
  product.status = "archived";
  product.visibility = "hidden";
  await product.save();
  const { indexProduct } = await import("./search/indexingService.js");
  await indexProduct(product._id).catch(() => {}); // re-indexed, not removed — isActive:false still lets admin search find it
  return product;
}
