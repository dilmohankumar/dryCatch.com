import * as variantService from "../services/variantService.js";

function toPublicShape(v) {
  return {
    id: v._id,
    sku: v.sku,
    weight: v.weight?.value ? { value: v.weight.value, unit: v.weight.unit, label: `${v.weight.value}${v.weight.unit}` } : undefined,
    attributes: v.attributes,
    price: v.price,
    mrp: v.mrp,
    discountPct: v.discountPct,
    status: v.status,
    isDefault: v.isDefault,
    sortOrder: v.sortOrder,
    media: v.media,
  };
}

// GET /products/:productId/variants — public: active+public only, customer-safe shape
export async function getVariants(req, res) {
  const variants = await variantService.listVariants(req.params.productId, { publicOnly: true });
  res.json({ variants: variants.map(toPublicShape) });
}

// GET /products/:productId/variants/:variantId
export async function getVariantById(req, res) {
  const variant = await variantService.getVariant(req.params.productId, req.params.variantId, { publicOnly: true });
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  res.json({ variant: toPublicShape(variant) });
}

// POST /products/:productId/variants (admin) — full doc, not the trimmed public shape
export async function createVariant(req, res) {
  const variant = await variantService.createVariant(req.params.productId, req.body);
  variantService.auditVariantEvent("VARIANT_CREATED", req.user._id, variant);
  res.status(201).json({ variant });
}

// PATCH /products/:productId/variants/:variantId (admin)
export async function updateVariant(req, res) {
  const variant = await variantService.updateVariant(req.params.productId, req.params.variantId, req.body);
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  variantService.auditVariantEvent("VARIANT_UPDATED", req.user._id, variant);
  res.json({ variant });
}

// DELETE /products/:productId/variants/:variantId (admin) — archives, never hard-deletes
export async function archiveVariant(req, res) {
  const variant = await variantService.archiveVariant(req.params.productId, req.params.variantId);
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  variantService.auditVariantEvent("VARIANT_ARCHIVED", req.user._id, variant);
  res.json({ message: "Variant archived", variant });
}

// GET /products/:productId/variants/admin (admin) — all statuses/visibility, full shape
export async function getVariantsAdmin(req, res) {
  const variants = await variantService.listVariants(req.params.productId, { publicOnly: false });
  res.json({ variants });
}
