// Documents the shape every payment provider adapter must implement. Not
// enforced by the language (plain JS, no interfaces) — a contract by
// convention, checked by the fact that paymentService.js only ever calls
// these method names on whatever `provider` object the factory hands it.
//
// createOrder({amount, currency, receipt}) -> { providerOrderId, raw }
// verifyPaymentSignature({providerOrderId, providerPaymentId, signature}) -> boolean
// verifyWebhookSignature({rawBody, signature}) -> boolean
// parseWebhookEvent(rawBody) -> { eventId, type, providerOrderId, providerPaymentId, amount, currency, status }
// fetchPayment(providerPaymentId) -> { providerPaymentId, amount, currency, status, method }
// refund({providerPaymentId, amount, notes}) -> { providerRefundId, status }
export const PAYMENT_PROVIDER_METHODS = [
  "createOrder",
  "verifyPaymentSignature",
  "verifyWebhookSignature",
  "parseWebhookEvent",
  "fetchPayment",
  "refund",
];
