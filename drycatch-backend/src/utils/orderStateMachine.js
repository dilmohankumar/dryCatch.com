// The explicit, single source of truth for which Order.status transitions
// are legal. Nothing in this codebase should ever do `order.status = X`
// without going through `assertValidTransition` first (the one exception is
// the very first `Order.create({..., status: "pending_payment"})`, which
// isn't a transition — it's the initial state).
//
// Deliberately does NOT include every status the wider spec names
// (RETURN_REQUESTED/RETURNED are represented in the enum for forward
// compatibility per Phase 9's "prepare for future returns" requirement, but
// no code path transitions into them yet — Returns is a future phase).
const TRANSITIONS = {
  pending_payment: ["payment_processing", "confirmed", "cancelled"],
  payment_processing: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: ["return_requested"],
  cancelled: [],
  return_requested: ["returned"],
  returned: ["refunded"],
  refunded: [],
};

export const ORDER_STATUSES = Object.keys(TRANSITIONS);

export function getAllowedTransitions(fromStatus) {
  return TRANSITIONS[fromStatus] || [];
}

export function isValidTransition(fromStatus, toStatus) {
  return getAllowedTransitions(fromStatus).includes(toStatus);
}

export function assertValidTransition(fromStatus, toStatus) {
  if (!isValidTransition(fromStatus, toStatus)) {
    throw Object.assign(
      new Error(`Cannot move an order from "${fromStatus}" to "${toStatus}"`),
      { statusCode: 409, code: "INVALID_ORDER_TRANSITION" }
    );
  }
}

// Fulfillment status is a separate, simpler dimension (rule #19) — it only
// exists once an order is confirmed, and only moves forward.
const FULFILLMENT_TRANSITIONS = {
  not_started: ["processing"],
  processing: ["packed"],
  packed: ["shipped"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
};

export function isValidFulfillmentTransition(from, to) {
  return (FULFILLMENT_TRANSITIONS[from] || []).includes(to);
}

// The order-status → fulfillment-status pairing for the admin status-update
// endpoint, which moves both dimensions together for the statuses where
// that's the same real-world event (rule #19's "this becomes important once
// shipping is implemented" — until a dedicated Fulfillment/Shipment domain
// exists, Order carries both fields directly).
export const ORDER_TO_FULFILLMENT_STATUS = {
  processing: "processing",
  packed: "packed",
  shipped: "shipped",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
};
