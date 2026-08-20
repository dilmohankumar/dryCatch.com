import Product from "../models/Product.js";
import * as productService from "../services/productService.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { recordAdminAction } from "../services/admin/adminAuditService.js";
import { resolveRedirect } from "../services/cms/redirectService.js";

// GET /products — whitelisted filters only: category, collection, tag,
// minPrice, maxPrice, sort, page, limit, search. Public listing always
// restricted to status=active, visibility=public (see productService).
export async function getProducts(req, res) {
  // Phase 25 — req.tenant is set by resolveTenantOptional (app.js) from
  // the Host header; undefined on a request that didn't resolve to a
  // known tenant (e.g. this project's own bare localhost dev/test
  // traffic), which is the pre-Phase-25 behavior, unchanged.
  const { items, pagination } = await productService.listProducts(req.query, req.tenant?._id);
  res.json({ success: true, data: { items, pagination } });
}

// GET /products/featured
export async function getFeaturedProducts(req, res) {
  const { items } = await productService.listProducts({ featured: "true", sort: "featured", limit: 12 });
  res.json({ products: items });
}

// GET /products/category/:categoryId — kept for backward compat with
// existing callers that pass a Category ObjectId directly; prefer
// GET /products?category=<slug> for new code.
export async function getProductsByCategory(req, res) {
  const products = await Product.find({
    status: "active",
    visibility: "public",
    category: req.params.categoryId,
  }).populate("category", "name slug");
  res.json({ products });
}

// GET /products/:idOrSlug — accepts either a Mongo _id or a slug.
export async function getProductById(req, res) {
  const product = await productService.getPublicProductByIdOrSlug(req.params.id, req.tenant?._id);
  if (!product) {
    // Phase 23 — a slug the admin renamed (rule #12/#13) still 404s at the
    // API level (this is a CSR SPA with no server-side routing layer to
    // issue a real HTTP 301 from — see docs/seo.md's "JavaScript SEO"
    // section), but the frontend can use this hint to client-side-navigate
    // the visitor to the current URL instead of dead-ending them.
    const redirect = await resolveRedirect(`/products/${req.params.id}`);
    return res.status(404).json({ message: "Product not found", redirectTo: redirect?.destination });
  }
  res.json({ product });
}

// POST /products (admin)
export async function createProduct(req, res) {
  const product = await productService.createProduct(req.body, req.tenant?._id);
  logAuditEvent("PRODUCT_CREATED", req.user._id, { productId: product._id, slug: product.slug });
  res.status(201).json({ product });
}

// PUT /products/:id (admin)
export async function updateProduct(req, res) {
  const before = await Product.findById(req.params.id).lean();
  if (!before) return res.status(404).json({ message: "Product not found" });
  const product = await productService.updateProduct(req.params.id, req.body, req.user._id, req.tenant?._id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  logAuditEvent("PRODUCT_UPDATED", req.user._id, { productId: product._id });
  await recordAdminAction({
    actor: req.user._id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: product._id,
    before, after: product.toObject(), req,
  }).catch(() => {});
  res.json({ product });
}

// DELETE /products/:id (admin) — archives, never hard-deletes: a past Order
// may still reference this product's _id, and hard-deleting would break
// that reference. See services/productService.js#archiveProduct.
export async function deleteProduct(req, res) {
  const product = await productService.archiveProduct(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  logAuditEvent("PRODUCT_ARCHIVED", req.user._id, { productId: product._id });
  res.json({ message: "Product archived", product });
}
