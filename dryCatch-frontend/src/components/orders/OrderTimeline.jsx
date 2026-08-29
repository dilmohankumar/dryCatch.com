// Renders whatever events the backend actually recorded for an order
// (GET /orders/:id/timeline) — never assumes every order passes through
// every stage. See docs/orders.md "Order events (the timeline)".
const EVENT_LABELS = {
  ORDER_CREATED: "Order Placed",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  PAYMENT_FAILED: "Payment Failed",
  REFUND_COMPLETED: "Refund Completed",
  REFUND_PARTIAL: "Partial Refund Issued",
  ORDER_CANCELLED: "Order Cancelled",
  ORDER_STATUS_CHANGED: "Status Updated",
};

const STATUS_WORD = {
  pending_payment: "Pending Payment",
  payment_processing: "Payment Processing",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return Requested",
  returned: "Returned",
  refunded: "Refunded",
};

function eventLabel(event) {
  const base = EVENT_LABELS[event.type] || event.type;
  if (event.type === "ORDER_STATUS_CHANGED" && event.toStatus) {
    return `${base}: ${STATUS_WORD[event.toStatus] || event.toStatus}`;
  }
  return base;
}

export default function OrderTimeline({ events }) {
  if (!events || events.length === 0) {
    return <p className="text-gray-500 text-sm">No timeline events yet.</p>;
  }

  return (
    <ol className="relative border-l-2 border-gray-200 ml-2">
      {events.map((event, idx) => (
        <li key={idx} className="mb-6 ml-4 last:mb-0">
          <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-[#1A3A5C] mt-1.5" />
          <p className="font-semibold">{eventLabel(event)}</p>
          {event.message && <p className="text-gray-600 text-sm">{event.message}</p>}
          <p className="text-gray-400 text-xs mt-0.5">
            {new Date(event.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
