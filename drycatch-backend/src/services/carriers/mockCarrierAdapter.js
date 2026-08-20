import crypto from "crypto";
import { MOCK_STATUS_MAP, normalizeStatus } from "./statusMapper.js";

// No real carrier account exists in this project (Shiprocket/Delhivery
// etc. all require a signed business contract) — this adapter is a fully
// working simulation, structurally identical to what a real adapter would
// implement (same six methods, same webhook signature/idempotency shape),
// so swapping it for a real one later is a drop-in replacement, not a
// rewrite. This is the inverse of Phase 8's stripeProvider stub: there,
// the stub was the non-working placeholder and Razorpay was real; here,
// `mock` is the one with working logic and `shiprocket`/`delhivery` are the
// honest stubs (see shiprocketAdapter.js).
let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

export const mockCarrierAdapter = {
  name: "mock",

  async getRates({ weightGrams = 500, orderValue = 0 }) {
    const standard = orderValue >= 999 ? 0 : 49;
    return [
      { method: "standard", cost: standard, etaDays: 4 },
      { method: "express", cost: 149, etaDays: 2 },
    ];
  },

  async getEstimatedDelivery({ method = "standard" } = {}) {
    const days = method === "express" ? 2 : 4;
    const from = new Date(Date.now() + days * 86400000);
    const to = new Date(Date.now() + (days + 2) * 86400000);
    return { from, to };
  },

  async createShipment({ orderNumber }) {
    const carrierShipmentId = nextId("MOCKSHIP");
    const trackingNumber = nextId("MOCKTRK");
    return {
      carrierShipmentId,
      trackingNumber,
      trackingUrl: `https://track.mockcarrier.test/${trackingNumber}`,
    };
  },

  async generateLabel(carrierShipmentId) {
    return { labelUrl: `https://labels.mockcarrier.test/${carrierShipmentId}.pdf` };
  },

  async cancelShipment() {
    return { cancelled: true };
  },

  async trackShipment(carrierShipmentId) {
    // A real adapter would call the carrier's tracking API here — used by
    // the polling-fallback job (rule #74) when webhooks aren't reliable.
    return { status: "in_transit", events: [] };
  },

  hasWebhookSecret() {
    return Boolean(process.env.MOCK_CARRIER_WEBHOOK_SECRET);
  },

  verifyWebhookSignature({ rawBody, signature }) {
    const secret = process.env.MOCK_CARRIER_WEBHOOK_SECRET;
    if (!secret || !signature || !rawBody) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  },

  parseWebhookEvent(body) {
    return {
      eventId: body.eventId,
      carrierShipmentId: body.carrierShipmentId,
      status: normalizeStatus(MOCK_STATUS_MAP, body.status),
      location: body.location,
      description: body.description,
      eventTime: body.eventTime ? new Date(body.eventTime) : new Date(),
    };
  },
};
