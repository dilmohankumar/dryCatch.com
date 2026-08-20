import Order from "../models/Order.js";
import Checkout from "../models/Checkout.js";
import CouponRedemption from "../models/CouponRedemption.js";
import * as inventoryService from "../services/inventoryService.js";
import * as orderService from "../services/orderService.js";
import * as paymentService from "../services/paymentService.js";
import { releaseRedemption } from "../services/promotions/redemptionService.js";
import { recordOrderEvent, getTimeline } from "../services/orderEventService.js";
import { assertValidTransition, ORDER_TO_FULFILLMENT_STATUS } from "../utils/orderStateMachine.js";
import { assertCustomerCanCancel } from "../utils/cancellationPolicy.js";
import { toOrderSummaryDTO, toOrderDetailDTO, toOrderTimelineEventDTO } from "../utils/orderDTO.js";
import * as eventBus from "../services/notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";

// POST /orders — { items: [{product, variant?, quantity}], shippingAddress }
// Legacy direct-create path (pre-dates the Checkout session, Phase 7) — kept
// working for backward compatibility, but now just calls the same
// orderService the Checkout flow uses, so there's one implementation of
// "resolve items → reserve stock → create payment" not two.
export async function createOrder(req, res) {
  const { items, shippingAddress } = req.body;
  const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
  const result = await orderService.createOrderFromItems({ userId: req.user._id, items, shippingAddress, idempotencyKey });
  res.status(201).json(result);
}

// POST /orders/verify — { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Client-side confirmation path. Delegates entirely to paymentService,
// which re-verifies the signature, re-checks amount/currency against our
// own Payment record, and is idempotent against the webhook arriving
// first (or arriving again after this already ran) — see
// docs/payments.md.
export async function verifyPayment(req, res) {
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const { order, payment } = await paymentService.verifyClientPayment(orderId, req.user._id, {
    providerOrderId: razorpay_order_id,
    providerPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  res.json({ order: toOrderDetailDTO(order), paymentStatus: payment.status });
}

// POST /orders/:id/retry-payment — a FAILED/EXPIRED payment on an
// otherwise still-payable order gets a fresh PaymentAttempt without
// destroying attempt history.
export async function retryPayment(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
  const result = await paymentService.retryPayment(order, { idempotencyKey });
  res.json({ razorpayOrderId: result.providerOrderId, amount: result.amount, reused: Boolean(result.reused) });
}

// GET /orders/:id/payment-status — lightweight polling endpoint for the
// "processing your payment" screen; never the sole source of truth for
// success (the frontend still waits on/re-checks after verify+webhook).
export async function getPaymentStatus(req, res) {
  const result = await paymentService.getPaymentStatus(req.params.id, req.user._id);
  res.json(result);
}

// GET /orders/my-orders?page=&limit=&status=&search=
// Paginated and lightweight (rules #36-#37, #78) — the list view never
// returns full item/address payloads, only what a card needs.
export async function getMyOrders(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.orderNumber = { $regex: req.query.search.trim(), $options: "i" };

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    orders: orders.map(toOrderSummaryDTO),
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
}

// GET /orders/:id — ownership enforced by userId, never by orderId alone
// (IDOR — rule #33). Admin (role check) may view any order.
export async function getOrderById(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (String(order.user) !== String(req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }
  res.json({ order: toOrderDetailDTO(order) });
}

// GET /orders/:id/timeline — the append-only OrderEvent history (rule #39).
// Same ownership rule as the order itself.
export async function getOrderTimeline(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (String(order.user) !== String(req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }
  const events = await getTimeline(order._id);
  res.json({ orderNumber: order.orderNumber, events: events.map(toOrderTimelineEventDTO) });
}

// PUT /orders/:id/cancel — a state transition, never a delete (rule #31,
// #109 — there is no DELETE /orders/:id anywhere in this codebase). Policy
// gate (cancellationPolicy) decides eligibility by current status, not by
// role — a customer cannot cancel a shipped order no matter how they ask.
export async function cancelOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  assertCustomerCanCancel(order);

  const fromStatus = order.status;

  if (order.paymentStatus === "succeeded") {
    // Payment already committed to inventory — cancelling now means
    // returning stock, not releasing a reservation that no longer exists.
    for (const item of order.items) {
      if (!item.variant) continue;
      await inventoryService.adjustStock({
        variantId: item.variant,
        delta: item.quantity,
        reason: `Order ${order.orderNumber} cancelled`,
        userId: req.user._id,
        type: "RETURN",
      }).catch(() => {});
    }
  } else {
    await inventoryService.releaseReservationsForReference("order", String(order._id));
    // Payment never succeeded on this order — any coupon/promotion it
    // redeemed must not stay permanently consumed (Phase 11 rule #28/#29).
    // Once payment HAS succeeded, a later cancellation does not reach this
    // branch — that redemption stays final (documented policy, see
    // docs/promotions.md).
    const redemptions = await CouponRedemption.find({ order: order._id, status: "redeemed" });
    for (const r of redemptions) await releaseRedemption(r._id);
  }

  order.status = "cancelled";
  await order.save();

  if (order.checkout) {
    await Checkout.findByIdAndUpdate(order.checkout, { status: "cancelled" });
  }

  await recordOrderEvent(order._id, {
    type: "ORDER_CANCELLED", fromStatus, toStatus: "cancelled", actorType: "CUSTOMER", actorId: req.user._id,
    message: "Cancelled by customer",
  });
  await eventBus.publish(EVENT_TYPES.ORDER_CANCELLED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(req.user._id) }, { source: "order" });

  res.json({ order: toOrderDetailDTO(order) });
}

// GET /orders (admin) — also paginated; an admin order list returned in
// full every time doesn't scale past a handful of orders.
export async function getAllOrders(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.orderNumber = { $regex: req.query.search.trim(), $options: "i" };

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "firstName lastName email"),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, page, limit, total, totalPages: Math.ceil(total / limit) });
}

// PUT /orders/:id/status (admin) — { status }. Every transition is
// validated against the explicit state machine (utils/orderStateMachine.js)
// — an admin cannot jump DELIVERED -> PROCESSING or set an unrecognized
// status string; only the transitions the graph allows succeed.
export async function updateOrderStatus(req, res) {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  assertValidTransition(order.status, status);

  const fromStatus = order.status;
  order.status = status;
  if (ORDER_TO_FULFILLMENT_STATUS[status]) order.fulfillmentStatus = ORDER_TO_FULFILLMENT_STATUS[status];
  await order.save();

  await recordOrderEvent(order._id, {
    type: "ORDER_STATUS_CHANGED", fromStatus, toStatus: status, actorType: "ADMIN", actorId: req.user._id,
  });

  res.json({ order: toOrderDetailDTO(order) });
}
