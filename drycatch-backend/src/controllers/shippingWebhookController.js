import * as shipmentService from "../services/shipmentService.js";

// POST /shipping/webhooks/:carrier — no auth middleware, same pattern as
// Phase 8's payment webhook: trust comes entirely from the signature check
// inside shipmentService.handleCarrierWebhook, computed over the raw
// request body (app.js's express.json `verify` hook — shared with the
// payment webhook, no separate raw-body capture needed).
export async function handleShippingWebhook(req, res) {
  const carrier = req.params.carrier;
  const signature = req.headers["x-mock-carrier-signature"] || req.headers["x-webhook-signature"];
  const result = await shipmentService.handleCarrierWebhook(carrier, {
    rawBody: req.rawBody,
    signature,
    body: req.body,
  });
  res.json(result);
}
