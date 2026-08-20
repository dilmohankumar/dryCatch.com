// Small, composable checks (rule #54 — "do not create one giant 500-line
// function") that promotionEngine.js runs in sequence for every candidate
// promotion. Each returns a plain {eligible, code, message} result rather
// than throwing, so the engine can silently skip an ineligible AUTOMATIC
// promotion while still surfacing a specific reason for a rejected COUPON.

function ok() {
  return { eligible: true };
}
function no(code, message) {
  return { eligible: false, code, message };
}

export function checkDateEligibility(startAt, endAt) {
  const now = new Date();
  if (startAt && now < new Date(startAt)) return no("COUPON_NOT_ACTIVE", "This coupon is not active yet");
  if (endAt && now > new Date(endAt)) return no("COUPON_EXPIRED", "This coupon has expired");
  return ok();
}

export function checkMinimumSubtotal(promotion, subtotal) {
  const min = promotion.conditions?.minSubtotal || 0;
  if (subtotal < min) return no("COUPON_MINIMUM_ORDER_NOT_MET", `This requires a minimum order of ₹${min}`);
  return ok();
}

export function checkMinimumQuantity(promotion, items) {
  const min = promotion.conditions?.minQuantity;
  if (!min) return ok();
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  if (totalQty < min) return no("COUPON_NOT_ELIGIBLE", `Requires at least ${min} items in cart`);
  return ok();
}

export function checkCustomerEligibility(promotion, customerId) {
  const ids = promotion.conditions?.customerIds;
  if (!ids?.length) return ok(); // empty = open to all customers
  const allowed = ids.some((id) => String(id) === String(customerId));
  return allowed ? ok() : no("COUPON_NOT_ELIGIBLE", "This coupon is not available for your account");
}

export function checkFirstOrder(promotion, isFirstOrder) {
  if (!promotion.conditions?.firstOrderOnly) return ok();
  return isFirstOrder ? ok() : no("COUPON_NOT_ELIGIBLE", "This coupon is only valid on your first order");
}

// Resolves WHICH cart items a promotion actually applies to — product/
// variant/category targeting, minus explicit exclusions. No targeting
// fields set at all means "the whole cart" (a plain cart-wide promotion).
// `categoryByProduct` is a Map<productId, categoryId> the caller resolves
// once per evaluateCart() call, not per promotion (avoids N+1 queries).
export function resolveEligibleIndexes(promotion, items, categoryByProduct) {
  const c = promotion.conditions || {};
  const hasTargeting = c.productIds?.length || c.variantIds?.length || c.categoryIds?.length;

  const indexes = [];
  items.forEach((item, i) => {
    const productId = String(item.product);
    const variantId = item.variant ? String(item.variant) : null;
    const categoryId = categoryByProduct?.get(productId) ? String(categoryByProduct.get(productId)) : null;

    if (c.excludedProductIds?.some((id) => String(id) === productId)) return;
    if (categoryId && c.excludedCategoryIds?.some((id) => String(id) === categoryId)) return;

    if (!hasTargeting) { indexes.push(i); return; }

    const matchesProduct = c.productIds?.some((id) => String(id) === productId);
    const matchesVariant = variantId && c.variantIds?.some((id) => String(id) === variantId);
    const matchesCategory = categoryId && c.categoryIds?.some((id) => String(id) === categoryId);
    if (matchesProduct || matchesVariant || matchesCategory) indexes.push(i);
  });

  return indexes;
}

// Runs every non-usage check for one promotion against one cart context.
// Usage-limit checks are deliberately NOT here — those require an atomic
// DB operation (redemptionService.js), not a plain boolean rule; this
// function only covers what can be decided from the promotion document and
// the cart itself.
export function evaluatePromotion(promotion, { items, subtotal, customerId, isFirstOrder, categoryByProduct, effectiveStartAt, effectiveEndAt }) {
  const checks = [
    checkDateEligibility(effectiveStartAt, effectiveEndAt),
    checkMinimumSubtotal(promotion, subtotal),
    checkMinimumQuantity(promotion, items),
    checkCustomerEligibility(promotion, customerId),
    checkFirstOrder(promotion, isFirstOrder),
  ];
  const failed = checks.find((r) => !r.eligible);
  if (failed) return failed;

  const eligibleIndexes = resolveEligibleIndexes(promotion, items, categoryByProduct);
  if (!eligibleIndexes.length) return no("COUPON_NOT_APPLICABLE", "This coupon doesn't apply to any items in your cart");

  return { eligible: true, eligibleIndexes };
}
