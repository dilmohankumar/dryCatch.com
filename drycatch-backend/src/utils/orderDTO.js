// Never return a raw Mongoose Order document to a customer — these shape
// exactly what's exposed, so a field added to the schema for internal use
// (idempotencyKey, checkout ref, legacy razorpaySignature) doesn't leak to
// the frontend just because someone added it to the model.

// Lightweight — for the order list page. No full item list, no addresses.
export function toOrderSummaryDTO(order) {
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    firstItemName: order.items[0]?.name,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

// Full detail — for the order detail page.
export function toOrderDetailDTO(order) {
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    items: order.items.map((i) => ({
      product: i.product,
      variant: i.variant,
      sku: i.sku,
      name: i.name,
      variantLabel: i.variantLabel,
      price: i.price,
      quantity: i.quantity,
      discountAmount: i.discountAmount || 0,
      lineTotal: Math.round((i.price * i.quantity - (i.discountAmount || 0)) * 100) / 100,
    })),
    subtotal: order.subtotal,
    shippingMethod: order.shippingMethod,
    shippingCost: order.shippingCost,
    taxAmount: order.taxAmount,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    promotions: (order.promotionSnapshots || []).map((p) => ({
      name: p.name, type: p.type, discountAmount: p.discountAmount, freeShipping: p.freeShipping,
    })),
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toOrderTimelineEventDTO(event) {
  return {
    type: event.type,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    message: event.message,
    actorType: event.actorType,
    createdAt: event.createdAt,
  };
}
