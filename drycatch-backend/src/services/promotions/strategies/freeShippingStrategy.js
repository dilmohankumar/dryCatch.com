// Doesn't touch item pricing at all — communicates "waive the shipping
// charge" back to the engine, which is applied against whatever
// shippingService already calculated (rule #45: never duplicate shipping
// calculation logic inside the discount engine).
export function calculate(promotion, items) {
  return { discountAmount: 0, freeShipping: true, allocations: items.map(() => 0) };
}
