// No Stripe account/credentials exist in this project — this adapter is
// structural only, so the provider abstraction (factory, paymentService)
// doesn't have to change shape the day Stripe actually gets wired in. Every
// method fails loudly rather than silently pretending to work, same
// "honest gap, not a fake implementation" rule followed by taxService in
// Phase 7.
function notConfigured() {
  throw Object.assign(new Error("Stripe is not configured for this deployment"), {
    statusCode: 503,
    code: "PROVIDER_NOT_CONFIGURED",
  });
}

export const stripeProvider = {
  name: "stripe",
  async createOrder() { notConfigured(); },
  verifyPaymentSignature() { notConfigured(); },
  hasWebhookSecret() { return false; },
  verifyWebhookSignature() { notConfigured(); },
  parseWebhookEvent() { notConfigured(); },
  async fetchPayment() { notConfigured(); },
  async refund() { notConfigured(); },
};
