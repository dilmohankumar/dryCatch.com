import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { checkPriceDrop } from "./growth/stockAlertService.js";

// Fields admin can set when CREATING a variant. `sku` is here — but only
// for create; see updateVariant, which deliberately excludes it.
const CREATE_FIELDS = ["sku", "weight", "attributes", "price", "mrp", "status", "visibility", "sortOrder", "media", "isDefault"];
// Fields admin can change on an EXISTING variant — `sku` and the identity
// fields (product, weight, attributes → combinationKey) are excluded once
// created, since changing them would silently redefine what a
// already-referenced SKU means (rule: SKU/combination stability).
const UPDATE_FIELDS = ["price", "mrp", "status", "visibility", "sortOrder", "media", "isDefault"];

function pick(fields, body) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

// Normalizes weight + free-form attributes into a stable string so two
// variants representing the same real-world combination (regardless of
// whitespace/case/ordering) can never both be created for one product.
export function computeCombinationKey({ weight, attributes }) {
  const weightPart = weight?.value != null && weight?.unit
    ? `weight:${Number(weight.value)}${String(weight.unit).toLowerCase().trim()}`
    : "weight:none";

  const attrEntries = Object.entries(attributes || {})
    .map(([k, v]) => [String(k).toLowerCase().trim(), String(v).toLowerCase().trim().replace(/\s+/g, " ")])
    .sort(([a], [b]) => a.localeCompare(b));

  const attrPart = attrEntries.map(([k, v]) => `${k}:${v}`).join("|");
  return [weightPart, attrPart].filter(Boolean).join("|");
}

function formatWeightLabel(weight) {
  if (!weight?.value || !weight?.unit) return "";
  return `${weight.value}${weight.unit}`.toUpperCase();
}

async function generateUniqueSku(product, weight) {
  const prefix = (product.slug || product.name)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6) || "SKU";
  const base = [prefix, formatWeightLabel(weight)].filter(Boolean).join("-");

  let candidate = base;
  let n = 2;
  while (await ProductVariant.exists({ sku: candidate })) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

async function unsetOtherDefaults(productId, exceptVariantId) {
  await ProductVariant.updateMany(
    { product: productId, _id: { $ne: exceptVariantId } },
    { $set: { isDefault: false } }
  );
}

export async function listVariants(productId, { publicOnly = true } = {}) {
  const filter = { product: productId };
  if (publicOnly) Object.assign(filter, { status: "active", visibility: "public" });
  return ProductVariant.find(filter).sort({ sortOrder: 1, createdAt: 1 });
}

export async function getVariant(productId, variantId, { publicOnly = true } = {}) {
  const filter = { _id: variantId, product: productId };
  if (publicOnly) Object.assign(filter, { status: "active", visibility: "public" });
  return ProductVariant.findOne(filter);
}

export async function createVariant(productId, body) {
  const product = await Product.findById(productId);
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  const data = pick(CREATE_FIELDS, body);
  if (data.price === undefined) throw Object.assign(new Error("price is required"), { statusCode: 400 });

  data.combinationKey = computeCombinationKey(data);
  data.sku = data.sku ? String(data.sku).toUpperCase().trim() : await generateUniqueSku(product, data.weight);

  const existingCount = await ProductVariant.countDocuments({ product: productId });
  if (existingCount === 0) data.isDefault = true; // first variant is always the default — deterministic, not random

  const variant = await ProductVariant.create({ ...data, product: productId });
  if (variant.isDefault) await unsetOtherDefaults(productId, variant._id);
  await reindexProductSearch(productId);
  return variant;
}

export async function updateVariant(productId, variantId, body) {
  const variant = await ProductVariant.findOne({ _id: variantId, product: productId });
  if (!variant) return null;

  const previousPrice = variant.price;
  Object.assign(variant, pick(UPDATE_FIELDS, body));
  await variant.save();
  if (variant.isDefault) await unsetOtherDefaults(productId, variant._id);
  await reindexProductSearch(productId); // variant price/attributes feed the product's search document (minPrice/maxPrice/sku)

  // Phase 24 — price-drop alerts (rule #21). Only the product's DEFAULT
  // variant drives price-drop subscriptions (those are subscribed at the
  // product level, tracking the price customers actually see on the
  // listing/product card) — a non-default variant's price change doesn't
  // fire this.
  if (variant.isDefault && typeof body.price === "number" && body.price !== previousPrice) {
    await checkPriceDrop(productId, previousPrice, variant.price).catch(() => {});
  }

  return variant;
}

async function reindexProductSearch(productId) {
  const { indexProduct } = await import("./search/indexingService.js");
  await indexProduct(productId).catch(() => {});
}

// Variants are never hard-deleted — a past Cart/Order may reference one.
export async function archiveVariant(productId, variantId) {
  const variant = await ProductVariant.findOne({ _id: variantId, product: productId });
  if (!variant) return null;
  variant.status = "archived";
  variant.visibility = "hidden";
  if (variant.isDefault) {
    variant.isDefault = false;
    const next = await ProductVariant.findOne({ product: productId, status: "active", _id: { $ne: variantId } }).sort({ sortOrder: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
  await variant.save();
  await reindexProductSearch(productId);
  return variant;
}

export function auditVariantEvent(type, userId, variant) {
  logAuditEvent(type, userId, { variantId: variant._id, productId: variant.product, sku: variant.sku });
}
