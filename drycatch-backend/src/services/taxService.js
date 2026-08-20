// Real integration point, honest zero — DryCatch has no tax requirement
// configured yet. Kept as a function (not a constant) so a future GST/
// CGST/SGST implementation is a body swap, not a new call site to wire in
// throughout checkout.
export function calculateTax({ subtotal, shippingCost, shippingAddress }) {
  return { taxAmount: 0, breakdown: {} };
}
