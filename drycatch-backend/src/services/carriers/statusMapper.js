// Carrier-specific status vocabulary never leaks past the adapter that
// produced it (rule #42/#92) — every adapter's parseWebhookEvent() runs its
// own carrier's raw string through the matching map here before handing a
// normalized internal status (matching Shipment.status's enum) to
// shipmentService. Two different carriers describing the same real-world
// event ("Dispatched" vs "Picked Up") both come out as the same internal
// value, so nothing downstream ever needs to know which carrier said it.
export const MOCK_STATUS_MAP = {
  CREATED: "created",
  LABEL_CREATED: "label_created",
  READY_FOR_PICKUP: "ready_for_pickup",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  DELIVERY_FAILED: "delivery_failed",
  RTO_INITIATED: "rto_initiated",
  RTO_IN_TRANSIT: "rto_in_transit",
  RTO_DELIVERED: "rto_delivered",
};

// Illustrates a differently-worded real-world carrier vocabulary mapping to
// the exact same internal set — this is what makes adding Shiprocket for
// real later a matter of filling in this map, not touching Shipment/Order
// logic anywhere else.
export const SHIPROCKET_STATUS_MAP = {
  "NEW": "created",
  "PICKUP SCHEDULED": "ready_for_pickup",
  "PICKED UP": "picked_up",
  "IN TRANSIT": "in_transit",
  "OUT FOR DELIVERY": "out_for_delivery",
  "DELIVERED": "delivered",
  "UNDELIVERED": "delivery_failed",
  "RTO INITIATED": "rto_initiated",
  "RTO DELIVERED": "rto_delivered",
};

export function normalizeStatus(map, rawStatus) {
  return map[String(rawStatus).toUpperCase().trim()] || null;
}
