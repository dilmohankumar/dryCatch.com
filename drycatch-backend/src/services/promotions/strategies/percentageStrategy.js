import { allocateDiscount } from "../discountAllocator.js";

function round2(n) { return Math.round(n * 100) / 100; }

// Percentage off the ELIGIBLE items' subtotal only — not the whole cart
// subtotal, since a product/category-targeted promotion must not discount
// items it was never configured for.
export function calculate(promotion, items, eligibleIndexes) {
  const eligibleSubtotal = eligibleIndexes.reduce((sum, i) => sum + items[i].price * items[i].quantity, 0);
  let discountAmount = round2((eligibleSubtotal * promotion.actions.value) / 100);
  if (promotion.actions.maxDiscount != null) discountAmount = Math.min(discountAmount, promotion.actions.maxDiscount);
  discountAmount = Math.min(discountAmount, eligibleSubtotal); // never negative-total territory
  return { discountAmount, freeShipping: false, allocations: allocateDiscount(items, eligibleIndexes, discountAmount) };
}
