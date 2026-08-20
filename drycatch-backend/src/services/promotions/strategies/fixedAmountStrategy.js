import { allocateDiscount } from "../discountAllocator.js";

// A flat rupee amount off the eligible items, capped at their subtotal so
// a ₹300-off coupon on a ₹200 eligible line never produces a negative
// remainder for that line.
export function calculate(promotion, items, eligibleIndexes) {
  const eligibleSubtotal = eligibleIndexes.reduce((sum, i) => sum + items[i].price * items[i].quantity, 0);
  const discountAmount = Math.min(promotion.actions.value, eligibleSubtotal);
  return { discountAmount, freeShipping: false, allocations: allocateDiscount(items, eligibleIndexes, discountAmount) };
}
