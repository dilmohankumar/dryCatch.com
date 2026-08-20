// Customer-initiated cancellation is allowed only before the order has
// physically left the warehouse. Once "packed" the picking/packing labor
// is already spent and once "shipped" a courier already has the parcel —
// past that point this becomes a Returns conversation (a future phase),
// not a cancellation.
const CANCELLABLE_STATUSES = ["pending_payment", "payment_processing", "confirmed", "processing"];

export function canCustomerCancel(order) {
  return CANCELLABLE_STATUSES.includes(order.status);
}

export function assertCustomerCanCancel(order) {
  if (!canCustomerCancel(order)) {
    throw Object.assign(
      new Error(`This order can no longer be cancelled (current status: ${order.status})`),
      { statusCode: 400, code: "ORDER_CANNOT_BE_CANCELLED" }
    );
  }
}
