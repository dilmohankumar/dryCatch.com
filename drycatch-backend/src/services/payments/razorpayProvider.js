import crypto from "crypto";
import { razorpay } from "../../utils/razorpay.js";

// Every Razorpay-specific concept (razorpay_order_id, razorpay_payment_id,
// razorpay_signature, the HMAC scheme, the webhook payload shape) stays
// inside this file. Nothing outside `services/payments/` should ever
// reference the razorpay SDK or these field names directly.
export const razorpayProvider = {
  name: "razorpay",

  async createOrder({ amount, currency, receipt }) {
    const order = await razorpay.orders.create({ amount, currency, receipt });
    return { providerOrderId: order.id, raw: order };
  },

  // Verifies the signature the client-side Razorpay SDK callback returns —
  // HMAC-SHA256("order_id|payment_id", key_secret).
  verifyPaymentSignature({ providerOrderId, providerPaymentId, signature }) {
    if (!providerOrderId || !providerPaymentId || !signature) return false;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest("hex");
    return expected === signature;
  },

  hasWebhookSecret() {
    return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);
  },

  // Verifies over the RAW bytes Razorpay sent — a re-serialized JSON body
  // can differ byte-for-byte from what was signed, which is why app.js
  // captures req.rawBody before any JSON parsing touches the request.
  verifyWebhookSignature({ rawBody, signature }) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature || !rawBody) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return expected === signature;
  },

  parseWebhookEvent(body) {
    const paymentEntity = body.payload?.payment?.entity;
    return {
      eventId: body.id || `${body.event}:${body.created_at}:${paymentEntity?.id || ""}`,
      type: body.event,
      providerOrderId: paymentEntity?.order_id,
      providerPaymentId: paymentEntity?.id,
      amount: paymentEntity?.amount,
      currency: paymentEntity?.currency,
      method: paymentEntity?.method,
      status: body.event === "payment.captured" ? "succeeded" : body.event === "payment.failed" ? "failed" : "pending",
      failureCode: paymentEntity?.error_code,
      failureMessage: paymentEntity?.error_description,
    };
  },

  async fetchPayment(providerPaymentId) {
    const payment = await razorpay.payments.fetch(providerPaymentId);
    return {
      providerPaymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status === "captured" ? "succeeded" : payment.status === "failed" ? "failed" : "pending",
    };
  },

  async refund({ providerPaymentId, amount, notes }) {
    const refund = await razorpay.payments.refund(providerPaymentId, { amount, notes });
    return { providerRefundId: refund.id, status: refund.status === "processed" ? "succeeded" : "pending" };
  },
};
