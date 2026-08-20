function round2(n) { return Math.round(n * 100) / 100; }

// Shared logic for BUY_X_GET_Y / BUY_X_GET_PERCENTAGE / BUY_X_GET_FIXED_PRICE
// — all three are "qualifying sets of units," differing only in what
// happens to the reward units within each complete set (rule #46: "do not
// hack this into percentage discount logic," these get their own strategy).
//
// Eligible line items are expanded into individual units, sorted ascending
// by price, and chunked into sets of (buyQuantity + getQuantity). Only
// FULL sets count — 5 units with buy:2/get:1 (set size 3) yields exactly
// one qualifying set (3 units), not one-and-a-third. Within each set, the
// first `getQuantity` units (cheapest, due to the ascending sort) become
// the reward units — a deterministic, documented convention rather than an
// ambiguous "whichever's cheaper" implicit rule.
export function calculate(promotion, items, eligibleIndexes) {
  const { buyQuantity = 1, getQuantity = 1, getDiscountPercent, getFixedPrice } = promotion.actions || {};
  const setSize = buyQuantity + getQuantity;

  const units = [];
  eligibleIndexes.forEach((i) => {
    for (let q = 0; q < items[i].quantity; q++) units.push({ index: i, price: items[i].price });
  });
  units.sort((a, b) => a.price - b.price);

  const allocations = items.map(() => 0);
  const fullSets = Math.floor(units.length / setSize);

  for (let s = 0; s < fullSets; s++) {
    const setUnits = units.slice(s * setSize, s * setSize + setSize);
    const rewardUnits = setUnits.slice(0, getQuantity);

    if (promotion.type === "BUY_X_GET_FIXED_PRICE") {
      const rewardOriginalSum = rewardUnits.reduce((sum, u) => sum + u.price, 0);
      const setDiscount = Math.max(0, round2(rewardOriginalSum - (getFixedPrice || 0)));
      // Distribute the set's discount proportionally across its reward units' origin lines.
      let allocated = 0;
      rewardUnits.forEach((u, idx) => {
        const isLast = idx === rewardUnits.length - 1;
        const share = isLast ? round2(setDiscount - allocated) : round2((u.price / rewardOriginalSum) * setDiscount);
        allocations[u.index] = round2(allocations[u.index] + share);
        allocated = round2(allocated + share);
      });
    } else {
      const perUnitFraction = promotion.type === "BUY_X_GET_PERCENTAGE" ? (getDiscountPercent || 0) / 100 : 1; // BUY_X_GET_Y = fully free
      rewardUnits.forEach((u) => {
        allocations[u.index] = round2(allocations[u.index] + round2(u.price * perUnitFraction));
      });
    }
  }

  const discountAmount = round2(allocations.reduce((sum, a) => sum + a, 0));
  return { discountAmount, freeShipping: false, allocations };
}
