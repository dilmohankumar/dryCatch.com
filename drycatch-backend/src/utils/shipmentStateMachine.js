const TRANSITIONS = {
  created: ["label_created", "label_failed", "cancelled"],
  label_failed: ["label_created", "cancelled"],
  label_created: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["picked_up", "cancelled"],
  picked_up: ["in_transit"],
  in_transit: ["out_for_delivery", "delivered", "delivery_failed"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivered: [],
  delivery_failed: ["out_for_delivery", "rto_initiated"],
  rto_initiated: ["rto_in_transit"],
  rto_in_transit: ["rto_delivered"],
  rto_delivered: [],
  cancelled: [],
};

// The normal forward-progress line — used to detect and drop an
// out-of-order/stale carrier event (rule #90: "carrier events can arrive
// late/duplicated/out of order — do not blindly move status backwards").
// RTO/failure/cancelled are separate branches, not ranked against this line.
const FORWARD_RANK = [
  "created", "label_failed", "label_created", "ready_for_pickup",
  "picked_up", "in_transit", "out_for_delivery", "delivered",
];

export function isValidShipmentTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertValidShipmentTransition(from, to) {
  if (!isValidShipmentTransition(from, to)) {
    throw Object.assign(
      new Error(`Cannot move a shipment from "${from}" to "${to}"`),
      { statusCode: 409, code: "INVALID_SHIPMENT_TRANSITION" }
    );
  }
}

// True when `to` would move the shipment backward along the normal forward
// line (e.g. current OUT_FOR_DELIVERY, incoming event says IN_TRANSIT) —
// the caller should record the event for history but not apply it as the
// shipment's current status.
export function isOnForwardLine(status) {
  return FORWARD_RANK.includes(status);
}

export function isStaleForwardEvent(currentStatus, incomingStatus) {
  const currentRank = FORWARD_RANK.indexOf(currentStatus);
  const incomingRank = FORWARD_RANK.indexOf(incomingStatus);
  if (currentRank === -1 || incomingRank === -1) return false; // one of them is off the forward line (RTO/cancelled) — not a forward-staleness case
  return incomingRank < currentRank;
}
