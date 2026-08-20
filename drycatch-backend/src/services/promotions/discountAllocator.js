function round2(n) {
  return Math.round(n * 100) / 100;
}

// Splits one lump discount across the specific cart items it applies to,
// proportional to each item's own line subtotal — required for refunds,
// returns, and tax calculations to know an item's ACTUAL paid price, not
// its pre-discount price (rule #31). The last eligible item absorbs the
// rounding remainder so allocations always sum to exactly `totalDiscount`,
// never a penny more or less through float drift.
//
// `items` — the full cart/order item list; `eligibleIndexes` — which of
// those indexes this discount actually applies to (product/category/
// variant targeting already resolved by ruleEvaluator).
export function allocateDiscount(items, eligibleIndexes, totalDiscount) {
  const allocations = items.map(() => 0);
  if (totalDiscount <= 0 || !eligibleIndexes.length) return allocations;

  const eligibleSubtotal = eligibleIndexes.reduce((sum, i) => sum + items[i].price * items[i].quantity, 0);
  if (eligibleSubtotal <= 0) return allocations;

  let allocated = 0;
  eligibleIndexes.forEach((i, idx) => {
    const lineSubtotal = items[i].price * items[i].quantity;
    const isLast = idx === eligibleIndexes.length - 1;
    const share = isLast ? round2(totalDiscount - allocated) : round2((lineSubtotal / eligibleSubtotal) * totalDiscount);
    allocations[i] = share;
    allocated = round2(allocated + share);
  });

  return allocations;
}

// Merges multiple promotions' allocations (each itself the output of
// allocateDiscount above) into one per-item total — used when more than
// one stackable promotion applies to the same cart.
export function mergeAllocations(items, allocationSets) {
  const merged = items.map(() => 0);
  for (const set of allocationSets) {
    set.forEach((amount, i) => { merged[i] = round2(merged[i] + amount); });
  }
  return merged;
}
