// Simple rule-based methods for now — the real point of this module is the
// BOUNDARY (frontend never computes or submits a shipping cost), not
// sophistication. Swap the rules for a carrier-rate API later without
// touching checkoutService's contract.
export function getShippingMethods({ subtotal }) {
  return [
    {
      id: "standard",
      name: "Standard Delivery",
      cost: subtotal >= 500 ? 0 : 49,
      etaDays: "3-5",
    },
    {
      id: "express",
      name: "Express Delivery",
      cost: 149,
      etaDays: "1-2",
    },
  ];
}

export function resolveShippingCost(methodId, { subtotal }) {
  const method = getShippingMethods({ subtotal }).find((m) => m.id === methodId);
  if (!method) {
    throw Object.assign(new Error("Selected shipping method is not available"), {
      statusCode: 400,
      code: "INVALID_SHIPPING_METHOD",
    });
  }
  return method;
}
