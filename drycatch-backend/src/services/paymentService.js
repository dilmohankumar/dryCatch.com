import Payment from "../models/Payment.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import Refund from "../models/Refund.js";
import Order from "../models/Order.js";
import Checkout from "../models/Checkout.js";
import WebhookEvent from "../models/WebhookEvent.js";
import CouponRedemption from "../models/CouponRedemption.js";
import * as inventoryService from "./inventoryService.js";
import { getProvider } from "./payments/providerFactory.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { recordOrderEvent } from "./orderEventService.js";
import { releaseRedemption } from "./promotions/redemptionService.js";
import * as eventBus from "./notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";
import { paymentOutcomeTotal, webhookOutcomeTotal } from "../utils/metrics.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Wraps a raw payment-provider SDK error into a clear, honest one — see
// the createPayment call site below for why this matters (a bare Razorpay
// SDK error reaches the client as an unhelpful "Server error").
function wrapProviderError(err) {
  const detail = err.error?.description || err.message || "unknown error";
  return Object.assign(new Error(`Payment gateway unavailable: ${detail}`), {
    statusCode: 502,
    code: "PAYMENT_GATEWAY_ERROR",
    cause: err,
  });
}

// Order.totalAmount is decimal rupees (matches the rest of Order/Checkout);
// Payment/PaymentAttempt store amounts in minor units (paise) per the
// provider-agnostic amount convention this phase introduces. This is the
// one conversion boundary — nothing downstream of Payment ever sees rupees.
function toMinorUnits(rupees) {
  return Math.round(rupees * 100);
}

// The order is the sole source of truth for what's payable — never a
// client-submitted amount/currency. Creates the internal Payment (status
// "created") + PaymentAttempt #1, then asks the configured provider to open
// its side of the transaction (Razorpay order / Stripe intent).
//
// Idempotent: a provided idempotencyKey is stored uniquely on the
// PaymentAttempt row. A retried identical request (same key) returns the
// existing attempt/payment instead of creating a second provider order —
// this is *in addition to* Checkout's own atomic claim (Phase 7), which
// already prevents the same checkout being submitted twice; this guard
// covers the payment-creation step specifically, including the legacy
// direct-order path that doesn't go through Checkout at all.
export async function createPaymentForOrder(order, { idempotencyKey, method } = {}) {
  // Namespaced with the order id: a client may resend the same
  // Idempotency-Key across retries of the *same* checkout attempt, but each
  // successful claim (Phase 7's atomic checkout claim) creates a brand-new
  // Order. Without the namespace, a stale key from an earlier order that
  // failed and was rolled back would incorrectly get reused against a
  // later, unrelated order.
  const scopedKey = idempotencyKey ? `${idempotencyKey}:${order._id}` : undefined;
  if (scopedKey) {
    const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey: scopedKey });
    if (existingAttempt) {
      const payment = await Payment.findById(existingAttempt.payment);
      return { payment, providerOrderId: payment.providerOrderId, amount: payment.amount, reused: true };
    }
  }

  const amount = toMinorUnits(order.totalAmount);
  const currency = "INR";

  // Cash on Delivery — no online gateway involved at all (rule: never call
  // a payment provider for a method that isn't actually processed by one).
  // Money is collected in person on delivery, so the Payment is created as
  // "pending" (NOT "succeeded" — that would falsely claim money was
  // already received) while the order itself is confirmed immediately,
  // same as a real online payment success would confirm it.
  if (method === "cod") {
    const payment = await Payment.create({
      order: order._id, checkout: order.checkout, user: order.user,
      provider: "cod", method: "cod", amount, currency, status: "pending",
    });
    const attempt = await PaymentAttempt.create({
      payment: payment._id, order: order._id, provider: "cod", amount, currency,
      status: "pending", attemptNumber: 1, idempotencyKey: scopedKey,
    });
    await confirmCodOrder(order, payment);
    logAuditEvent("PAYMENT_CREATED", order.user, { paymentId: String(payment._id), orderId: String(order._id), attemptId: String(attempt._id), provider: "cod" });
    return { payment, providerOrderId: null, amount, method: "cod" };
  }

  const provider = getProvider();

  const payment = await Payment.create({
    order: order._id,
    checkout: order.checkout,
    user: order.user,
    provider: provider.name,
    amount,
    currency,
    status: "created",
  });

  let providerResult;
  try {
    providerResult = await provider.createOrder({ amount, currency, receipt: `rcpt_${order._id}` });
  } catch (err) {
    payment.status = "failed";
    payment.failureMessage = "Payment provider order creation failed";
    await payment.save();
    throw wrapProviderError(err);
  }

  payment.providerOrderId = providerResult.providerOrderId;
  payment.status = "pending";
  await payment.save();

  const attempt = await PaymentAttempt.create({
    payment: payment._id,
    order: order._id,
    provider: provider.name,
    providerReference: providerResult.providerOrderId,
    amount,
    currency,
    status: "pending",
    attemptNumber: 1,
    idempotencyKey: scopedKey,
  });

  logAuditEvent("PAYMENT_CREATED", order.user, { paymentId: String(payment._id), orderId: String(order._id), attemptId: String(attempt._id) });
  return { payment, providerOrderId: payment.providerOrderId, amount };
}

// A previously FAILED/EXPIRED/CANCELLED payment on an otherwise still-payable
// order gets a fresh attempt without touching attempt history. Only allowed
// when the order and payment are actually in a retryable state (rules #37).
export async function retryPayment(order, { idempotencyKey } = {}) {
  if (["packed", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"].includes(order.status)) {
    fail("This order can no longer be paid for", "ORDER_NOT_PAYABLE", 400);
  }

  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  if (!payment) fail("No payment found for this order", "PAYMENT_NOT_FOUND", 404);
  if (["succeeded", "refunded", "partially_refunded"].includes(payment.status)) {
    fail("This order has already been paid", "PAYMENT_ALREADY_COMPLETED", 409);
  }

  if (idempotencyKey) {
    const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
    if (existingAttempt) {
      return { payment, providerOrderId: existingAttempt.providerReference, amount: existingAttempt.amount, reused: true };
    }
  }

  const provider = getProvider();
  const lastAttempt = await PaymentAttempt.findOne({ order: order._id }).sort({ attemptNumber: -1 });
  const nextAttemptNumber = (lastAttempt?.attemptNumber || 0) + 1;

  let providerResult;
  try {
    providerResult = await provider.createOrder({
      amount: payment.amount,
      currency: payment.currency,
      receipt: `rcpt_${order._id}_r${nextAttemptNumber}`,
    });
  } catch (err) {
    throw wrapProviderError(err);
  }

  payment.providerOrderId = providerResult.providerOrderId;
  payment.status = "pending";
  payment.failureCode = undefined;
  payment.failureMessage = undefined;
  await payment.save();

  const attempt = await PaymentAttempt.create({
    payment: payment._id,
    order: order._id,
    provider: provider.name,
    providerReference: providerResult.providerOrderId,
    amount: payment.amount,
    currency: payment.currency,
    status: "pending",
    attemptNumber: nextAttemptNumber,
    idempotencyKey,
  });

  logAuditEvent("PAYMENT_RETRY", order.user, { paymentId: String(payment._id), orderId: String(order._id), attemptNumber: nextAttemptNumber });
  return { payment, providerOrderId: payment.providerOrderId, amount: payment.amount };
}

// Shared "this payment is now genuinely confirmed" transition — used by
// both the client-side verify path and the webhook path, since either can
// arrive first (rule: "webhook arrives before frontend callback"). Amount
// and currency are re-checked against OUR OWN Payment record (never trusted
// from the provider payload alone) before anything is marked succeeded.
async function markSucceeded(payment, { providerPaymentId, method, providerAmount, providerCurrency, via }) {
  if (payment.status === "succeeded") return payment; // already processed — idempotent no-op

  if (providerAmount != null && providerAmount !== payment.amount) {
    logAuditEvent("PAYMENT_AMOUNT_MISMATCH", payment.user, {
      paymentId: String(payment._id), expected: payment.amount, received: providerAmount, via,
    });
    fail("Payment amount does not match the order", "PAYMENT_AMOUNT_MISMATCH", 409);
  }
  if (providerCurrency != null && providerCurrency.toUpperCase() !== payment.currency) {
    logAuditEvent("PAYMENT_CURRENCY_MISMATCH", payment.user, {
      paymentId: String(payment._id), expected: payment.currency, received: providerCurrency, via,
    });
    fail("Payment currency does not match the order", "PAYMENT_CURRENCY_MISMATCH", 409);
  }

  payment.status = "succeeded";
  payment.providerPaymentId = providerPaymentId;
  payment.method = method;
  await payment.save();

  await PaymentAttempt.updateOne(
    { payment: payment._id, providerReference: payment.providerOrderId },
    { $set: { status: "succeeded" } }
  );

  await eventBus.publish(EVENT_TYPES.PAYMENT_SUCCESSFUL, { orderId: String(payment.order), userId: String(payment.user), orderNumber: undefined }, { source: "payment" });

  const order = await Order.findById(payment.order);
  if (order && ["pending_payment", "payment_processing"].includes(order.status)) {
    await inventoryService.commitReservationsForReference("order", String(order._id), order.user);
    const fromStatus = order.status;
    order.status = "confirmed";
    order.paymentStatus = "succeeded";
    order.razorpayPaymentId = providerPaymentId; // legacy field, kept for the existing frontend/order views
    await order.save();
    if (order.checkout) await Checkout.findByIdAndUpdate(order.checkout, { status: "completed" });
    await recordOrderEvent(order._id, {
      type: "PAYMENT_CONFIRMED", fromStatus, toStatus: "confirmed", actorType: "PAYMENT_PROVIDER",
      message: `Payment confirmed via ${via}`,
    });
    await eventBus.publish(EVENT_TYPES.ORDER_CONFIRMED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(order.user) }, { source: "order" });
  }

  logAuditEvent("PAYMENT_SUCCEEDED", payment.user, { paymentId: String(payment._id), orderId: String(payment.order), via });
  paymentOutcomeTotal.inc({ outcome: "succeeded", provider: payment.provider });
  return payment;
}

async function markFailed(payment, { failureCode, failureMessage, via }) {
  if (["succeeded", "failed", "refunded", "partially_refunded"].includes(payment.status)) return payment;

  payment.status = "failed";
  payment.failureCode = failureCode;
  payment.failureMessage = failureMessage;
  await payment.save();
  paymentOutcomeTotal.inc({ outcome: "failed", provider: payment.provider });

  await PaymentAttempt.updateOne(
    { payment: payment._id, providerReference: payment.providerOrderId },
    { $set: { status: "failed", failureCode, failureMessage } }
  );

  await eventBus.publish(EVENT_TYPES.PAYMENT_FAILED, { orderId: String(payment.order), userId: String(payment.user) }, { source: "payment" });

  const order = await Order.findById(payment.order);
  if (order && ["pending_payment", "payment_processing"].includes(order.status)) {
    await inventoryService.releaseReservationsForReference("order", String(order._id));
    const fromStatus = order.status;
    order.status = "cancelled";
    order.paymentStatus = "failed";
    await order.save();
    if (order.checkout) await Checkout.findByIdAndUpdate(order.checkout, { status: "failed" });
    // Payment never succeeded — any coupon/promotion redeemed for this
    // order must not stay permanently consumed (Phase 11 rule #28).
    const redemptions = await CouponRedemption.find({ order: order._id, status: "redeemed" });
    for (const r of redemptions) await releaseRedemption(r._id);
    await recordOrderEvent(order._id, {
      type: "PAYMENT_FAILED", fromStatus, toStatus: "cancelled", actorType: "PAYMENT_PROVIDER",
      message: failureMessage || "Payment failed", metadata: { failureCode },
    });
  }

  logAuditEvent("PAYMENT_FAILED", payment.user, { paymentId: String(payment._id), orderId: String(payment.order), failureCode, via });
  return payment;
}

// Confirms a COD order the same way a successful online payment would —
// commits the inventory reservation (the order is genuinely placed, not
// just tentatively held), moves the order to "confirmed", and closes out
// the checkout — but deliberately does NOT touch Payment.status (stays
// "pending" until the cash is actually collected on delivery, updated
// separately by whatever marks a COD order delivered/collected).
async function confirmCodOrder(order, payment) {
  await inventoryService.commitReservationsForReference("order", String(order._id), order.user);
  const fromStatus = order.status;
  order.status = "confirmed";
  order.paymentStatus = "pending";
  await order.save();
  if (order.checkout) await Checkout.findByIdAndUpdate(order.checkout, { status: "completed" });
  await recordOrderEvent(order._id, {
    type: "ORDER_CONFIRMED", fromStatus, toStatus: "confirmed", actorType: "CUSTOMER",
    message: "Order confirmed — Cash on Delivery",
  });
  await eventBus.publish(EVENT_TYPES.ORDER_CONFIRMED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(order.user) }, { source: "order" });
  paymentOutcomeTotal.inc({ outcome: "cod_confirmed", provider: "cod" });
  return payment;
}

// The client-side confirmation path (Razorpay checkout.js success callback).
// Never trusted alone — signature is verified, amount/currency re-checked
// against our own Payment row inside markSucceeded. The webhook (below) is
// the resilient path that confirms the same thing independently if the
// customer closes the tab before this ever runs.
export async function verifyClientPayment(orderId, userId, { providerOrderId, providerPaymentId, signature }) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) fail("Order not found", "PAYMENT_NOT_FOUND", 404);

  const payment = await Payment.findOne({ order: order._id, providerOrderId });
  if (!payment) fail("Payment not found for this order", "PAYMENT_NOT_FOUND", 404);

  const provider = getProvider(payment.provider);
  const valid = provider.verifyPaymentSignature({ providerOrderId, providerPaymentId, signature });
  if (!valid) {
    logAuditEvent("WEBHOOK_VERIFICATION_FAILED", userId, { paymentId: String(payment._id), via: "client-verify" });
    fail("Payment verification failed", "PAYMENT_VERIFICATION_FAILED", 400);
  }

  await markSucceeded(payment, { providerPaymentId, via: "client-verify" });
  return { order: await Order.findById(order._id), payment };
}

// The webhook path — provider-authenticated, idempotent, and independent of
// whether the client-side callback ever fires. `rawBody` must be the exact
// bytes the provider signed (see app.js's express.json `verify` hook).
export async function handleWebhookEvent(providerName, { rawBody, signature, body }) {
  const provider = getProvider(providerName);

  if (!provider.hasWebhookSecret()) {
    fail("Webhook not configured", "WEBHOOK_NOT_CONFIGURED", 503); // fail closed, never process an unverifiable webhook
  }
  if (!provider.verifyWebhookSignature({ rawBody, signature })) {
    logAuditEvent("WEBHOOK_VERIFICATION_FAILED", null, { provider: providerName });
    webhookOutcomeTotal.inc({ provider: providerName, outcome: "invalid_signature" });
    fail("Invalid webhook signature", "WEBHOOK_VERIFICATION_FAILED", 400);
  }

  const parsed = provider.parseWebhookEvent(body);

  try {
    await WebhookEvent.create({ provider: providerName, providerEventId: parsed.eventId, type: parsed.type });
  } catch (err) {
    if (err.code === 11000) {
      webhookOutcomeTotal.inc({ provider: providerName, outcome: "duplicate" });
      return { ok: true, duplicate: true }; // already processed — provider retried
    }
    throw err;
  }

  if (!parsed.providerOrderId) {
    webhookOutcomeTotal.inc({ provider: providerName, outcome: "ignored" });
    return { ok: true, ignored: true };
  }
  const payment = await Payment.findOne({ provider: providerName, providerOrderId: parsed.providerOrderId });
  if (!payment) {
    webhookOutcomeTotal.inc({ provider: providerName, outcome: "ignored" });
    return { ok: true, ignored: true }; // event for something outside our system, or a payment we never created
  }
  webhookOutcomeTotal.inc({ provider: providerName, outcome: "processed" });

  if (parsed.status === "succeeded") {
    await markSucceeded(payment, {
      providerPaymentId: parsed.providerPaymentId,
      method: parsed.method,
      providerAmount: parsed.amount,
      providerCurrency: parsed.currency?.toUpperCase(),
      via: "webhook",
    });
  } else if (parsed.status === "failed") {
    await markFailed(payment, { failureCode: parsed.failureCode, failureMessage: parsed.failureMessage, via: "webhook" });
  }

  return { ok: true };
}

// Admin-only. Idempotent via idempotencyKey; enforces refundable-amount
// bounds so a refund can never exceed what's actually left to refund.
export async function refundPayment(paymentId, { amount, reason, idempotencyKey } = {}) {
  if (idempotencyKey) {
    const existing = await Refund.findOne({ idempotencyKey });
    if (existing) return { refund: existing, reused: true };
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) fail("Payment not found", "PAYMENT_NOT_FOUND", 404);
  if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
    fail("Only a succeeded payment can be refunded", "PAYMENT_NOT_REFUNDABLE", 400);
  }

  const refundable = payment.amount - payment.refundedAmount;
  const refundAmount = amount != null ? amount : refundable;
  if (refundAmount <= 0 || refundAmount > refundable) {
    fail(`Refund amount exceeds the refundable balance (${refundable} minor units remaining)`, "REFUND_EXCEEDS_BALANCE", 400);
  }

  const provider = getProvider(payment.provider);
  const providerResult = await provider.refund({ providerPaymentId: payment.providerPaymentId, amount: refundAmount, notes: { reason } });

  const refund = await Refund.create({
    payment: payment._id,
    order: payment.order,
    provider: payment.provider,
    providerRefundId: providerResult.providerRefundId,
    amount: refundAmount,
    currency: payment.currency,
    status: providerResult.status,
    reason,
    idempotencyKey,
  });

  await eventBus.publish(EVENT_TYPES.REFUND_CREATED, { orderId: String(payment.order), userId: String(payment.user), refundId: String(refund._id) }, { source: "payment" });

  if (providerResult.status === "succeeded") {
    payment.refundedAmount += refundAmount;
    payment.status = payment.refundedAmount >= payment.amount ? "refunded" : "partially_refunded";
    await payment.save();

    const order = await Order.findById(payment.order);
    if (order) {
      const fromStatus = order.status;
      order.paymentStatus = payment.status;
      // A full refund can legitimately happen from almost any post-payment
      // order status (confirmed, processing, even after delivery) — this
      // intentionally bypasses orderStateMachine's narrower admin-facing
      // transition graph rather than trying to enumerate every "X ->
      // refunded" edge there.
      if (payment.status === "refunded") order.status = "refunded";
      await order.save();
      await recordOrderEvent(order._id, {
        type: payment.status === "refunded" ? "REFUND_COMPLETED" : "REFUND_PARTIAL",
        fromStatus, toStatus: order.status, actorType: "ADMIN",
        message: reason || "Refund processed", metadata: { amount: refundAmount },
      });
      if (payment.status === "refunded") {
        await eventBus.publish(EVENT_TYPES.REFUND_COMPLETED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(order.user) }, { source: "payment" });
      }
    }
  }

  logAuditEvent(providerResult.status === "succeeded" ? "REFUND_SUCCEEDED" : "REFUND_CREATED", payment.user, {
    paymentId: String(payment._id), refundId: String(refund._id), amount: refundAmount,
  });

  return { refund, reused: false };
}

export async function getPaymentStatus(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) fail("Order not found", "PAYMENT_NOT_FOUND", 404);
  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  return { orderStatus: order.status, paymentStatus: payment?.status || null };
}
