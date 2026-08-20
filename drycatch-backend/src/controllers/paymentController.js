import * as paymentService from "../services/paymentService.js";

// POST /payments/webhook/razorpay — the resilient path alongside the
// client-triggered /orders/verify: if a customer pays and closes the tab
// before the client-side callback fires, this is what still confirms the
// order. Delegates everything (signature verify, dedup, state transitions)
// to paymentService.handleWebhookEvent, which is provider-agnostic — this
// controller's only job is picking the right header/raw-body off the
// request for whichever :provider segment the URL names.
export async function handleWebhook(req, res) {
  const provider = req.params.provider;
  const signature = req.headers["x-razorpay-signature"] || req.headers["stripe-signature"];
  const result = await paymentService.handleWebhookEvent(provider, {
    rawBody: req.rawBody,
    signature,
    body: req.body,
  });
  res.json(result);
}

// POST /payments/:paymentId/refund (admin only) — { amount?, reason }
// amount is in minor units and optional (omit for a full refund of the
// remaining refundable balance). Idempotent via Idempotency-Key header.
export async function createRefund(req, res) {
  const { amount, reason } = req.body;
  const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
  const result = await paymentService.refundPayment(req.params.paymentId, { amount, reason, idempotencyKey });
  // Refunds are exactly the kind of sensitive, financial admin action rule
  // #44/#140 call out by name — audited with the actual amount/reason,
  // never inferred from "a refund happened."
  const { recordAdminAction } = await import("../services/admin/adminAuditService.js");
  await recordAdminAction({
    actor: req.user._id, action: "PAYMENT_REFUNDED", entityType: "Payment", entityId: req.params.paymentId,
    after: { amount: result.refund.amount, reason, reused: result.reused }, req,
  }).catch(() => {});
  res.status(201).json(result);
}
