const TRANSITIONS = {
  pending: ["allocated", "cancelled"],
  allocated: ["picking", "cancelled"],
  picking: ["packing", "cancelled"],
  packing: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

export function isValidFulfillmentTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertValidFulfillmentTransition(from, to) {
  if (!isValidFulfillmentTransition(from, to)) {
    throw Object.assign(
      new Error(`Cannot move a fulfillment from "${from}" to "${to}"`),
      { statusCode: 409, code: "INVALID_FULFILLMENT_TRANSITION" }
    );
  }
}
