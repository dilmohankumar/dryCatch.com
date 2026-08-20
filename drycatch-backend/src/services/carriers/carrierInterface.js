// Documents the shape every carrier adapter must implement — same
// contract-by-convention approach as services/payments/providerInterface.js
// (Phase 8). shipmentService.js only ever calls these method names on
// whatever carrierFactory.getCarrier() returns.
//
// getRates({destinationPincode, weightGrams, orderValue}) -> [{method, cost, etaDays}]
// getEstimatedDelivery({destinationPincode, method}) -> {from: Date, to: Date}
// createShipment({orderNumber, shippingAddress, items, method}) -> { carrierShipmentId, trackingNumber, trackingUrl }
// generateLabel(carrierShipmentId) -> { labelUrl }
// cancelShipment(carrierShipmentId) -> { cancelled: boolean }
// trackShipment(carrierShipmentId) -> { status, events: [{status, location, description, eventTime}] }
// hasWebhookSecret() -> boolean
// verifyWebhookSignature({rawBody, signature}) -> boolean
// parseWebhookEvent(body) -> { eventId, carrierShipmentId, status, location, description, eventTime }
export const CARRIER_METHODS = [
  "getRates",
  "getEstimatedDelivery",
  "createShipment",
  "generateLabel",
  "cancelShipment",
  "trackShipment",
  "hasWebhookSecret",
  "verifyWebhookSignature",
  "parseWebhookEvent",
];
