// No Shiprocket account/credentials exist in this project — honest stub,
// same "fails loudly, never fakes success" rule as Phase 8's stripeProvider.
// See statusMapper.js's SHIPROCKET_STATUS_MAP for what a real
// parseWebhookEvent implementation here would map through.
function notConfigured() {
  throw Object.assign(new Error("Shiprocket is not configured for this deployment"), {
    statusCode: 503,
    code: "CARRIER_NOT_CONFIGURED",
  });
}

export const shiprocketAdapter = {
  name: "shiprocket",
  async getRates() { notConfigured(); },
  async getEstimatedDelivery() { notConfigured(); },
  async createShipment() { notConfigured(); },
  async generateLabel() { notConfigured(); },
  async cancelShipment() { notConfigured(); },
  async trackShipment() { notConfigured(); },
  hasWebhookSecret() { return false; },
  verifyWebhookSignature() { notConfigured(); },
  parseWebhookEvent() { notConfigured(); },
};
