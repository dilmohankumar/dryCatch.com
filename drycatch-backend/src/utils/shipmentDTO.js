// Customer-facing shipment/tracking shape — never the raw Mongoose
// document. Excludes carrierShipmentId (internal carrier reference),
// carrierShippingCost (rule #52 — never reveal what the carrier actually
// charges, only what the customer paid), idempotencyKey, and raw webhook
// metadata.
export function toShipmentSummaryDTO(shipment) {
  return {
    id: shipment._id,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    status: shipment.status,
    shippingMethod: shipment.shippingMethod,
    customerShippingCharge: shipment.customerShippingCharge,
    estimatedDelivery: shipment.estimatedDeliveryFrom
      ? { from: shipment.estimatedDeliveryFrom, to: shipment.estimatedDeliveryTo }
      : null,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
  };
}

export function toShipmentTrackingDTO(shipment, events) {
  return {
    ...toShipmentSummaryDTO(shipment),
    events: events.map((e) => ({
      status: e.status,
      location: e.location,
      description: e.description,
      eventTime: e.eventTime,
    })),
  };
}
