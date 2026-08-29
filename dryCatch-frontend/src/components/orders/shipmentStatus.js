// Human labels/colors for Shipment.status (see docs/shipping.md "State
// machines"). Shared between the shipment card badge and the tracking
// timeline so a status always reads the same way everywhere.
export const SHIPMENT_STATUS_LABELS = {
  created: "Created",
  label_failed: "Label Failed",
  label_created: "Label Created",
  ready_for_pickup: "Ready for Pickup",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  delivery_failed: "Delivery Failed",
  rto_initiated: "Return Initiated",
  rto_in_transit: "Return In Transit",
  rto_delivered: "Returned to Sender",
  cancelled: "Cancelled",
};

export function shipmentStatusLabel(status) {
  return SHIPMENT_STATUS_LABELS[status] || status;
}

export function shipmentStatusColor(status) {
  switch (status) {
    case "delivered":
      return "bg-green-100 text-green-800";
    case "delivery_failed":
    case "label_failed":
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "rto_initiated":
    case "rto_in_transit":
    case "rto_delivered":
      return "bg-orange-100 text-orange-800";
    case "out_for_delivery":
    case "in_transit":
    case "picked_up":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
