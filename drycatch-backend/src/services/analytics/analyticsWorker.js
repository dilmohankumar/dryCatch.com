import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import Shipment from "../../models/Shipment.js";
import Product from "../../models/Product.js";
import DailySalesMetric from "../../models/DailySalesMetric.js";
import ProductDailyMetric from "../../models/ProductDailyMetric.js";
import CategoryDailyMetric from "../../models/CategoryDailyMetric.js";
import CustomerDailyMetric from "../../models/CustomerDailyMetric.js";
import PaymentDailyMetric from "../../models/PaymentDailyMetric.js";
import ShippingDailyMetric from "../../models/ShippingDailyMetric.js";
import DiscountDailyMetric from "../../models/DiscountDailyMetric.js";
import FunnelDailyMetric from "../../models/FunnelDailyMetric.js";
import VisitorDaily from "../../models/VisitorDaily.js";
import { subscribe } from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";
import { toDateKey } from "../../utils/businessDate.js";
import { invalidatePrefix } from "../../utils/analyticsCache.js";

// This is the "ANALYTICS WORKER" box from the phase diagram — the only
// place that turns a domain/behavioral event into an aggregate update.
// Every write here is an incremental $inc upsert (rule #69), never a
// recompute of history. Payloads from eventBus are minimal (ids only), so
// handlers re-fetch whatever fields they need — same "re-fetch at process
// time" pattern already used by CMS/notifications in earlier phases.

async function bumpSales(dateKey, fields) {
  await DailySalesMetric.findOneAndUpdate({ dateKey }, { $inc: fields }, { upsert: true });
  invalidatePrefix(`sales:${dateKey.slice(0, 7)}`); // invalidate the month this day belongs to
}

async function handleOrderCreated({ orderId, userId }) {
  const order = await Order.findById(orderId).populate("items.product", "category");
  if (!order) return;
  const dateKey = toDateKey(order.createdAt);

  await bumpSales(dateKey, {
    grossSales: order.subtotal || 0,
    discountAmount: order.discountAmount || 0,
    taxAmount: order.taxAmount || 0,
    shippingRevenue: order.shippingCost || 0,
    ordersCount: 1,
    unitsSold: order.items.reduce((sum, i) => sum + i.quantity, 0),
  });

  // Product + category breakdown
  for (const item of order.items) {
    const lineRevenue = (item.price || 0) * item.quantity;
    await ProductDailyMetric.findOneAndUpdate(
      { dateKey, product: item.product?._id || item.product },
      { $inc: { purchases: 1, unitsSold: item.quantity, revenue: lineRevenue } },
      { upsert: true }
    );
    const categoryId = item.product?.category;
    if (categoryId) {
      await CategoryDailyMetric.findOneAndUpdate(
        { dateKey, category: categoryId },
        { $inc: { orders: 1, units: item.quantity, revenue: lineRevenue } },
        { upsert: true }
      );
    }
  }

  // New vs returning (rule #16/#19) — "first order ever" check, cheap and
  // indexed (user + createdAt).
  const priorOrders = await Order.countDocuments({ user: userId, _id: { $ne: order._id } });
  const isNew = priorOrders === 0;
  await CustomerDailyMetric.findOneAndUpdate(
    { dateKey },
    { $inc: isNew ? { newCustomers: 1, newCustomerRevenue: order.totalAmount } : { returningCustomers: 1, returningCustomerRevenue: order.totalAmount } },
    { upsert: true }
  );

  // Coupon/discount analytics
  if (order.couponCode) {
    await DiscountDailyMetric.findOneAndUpdate(
      { dateKey, couponCode: order.couponCode },
      { $inc: { usageCount: 1, discountAmount: order.discountAmount || 0, revenue: order.totalAmount || 0 } },
      { upsert: true }
    );
  }

  // Funnel — an order completing today (rule #46's last stage)
  await FunnelDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { orderCompleted: 1 } }, { upsert: true });
}

async function handleOrderCancelled({ orderId }) {
  const order = await Order.findById(orderId, "createdAt");
  if (!order) return;
  await bumpSales(toDateKey(order.createdAt), { cancelledCount: 1 });
}

async function handlePaymentEvent(eventType, { orderId }) {
  const payment = await Payment.findOne({ order: orderId }).sort({ createdAt: -1 });
  if (!payment) return;
  const dateKey = toDateKey(payment.updatedAt || payment.createdAt);
  const method = payment.method || "unknown";

  if (eventType === EVENT_TYPES.PAYMENT_SUCCESSFUL) {
    await bumpSales(dateKey, { paidRevenue: payment.amount });
    await PaymentDailyMetric.findOneAndUpdate(
      { dateKey, provider: payment.provider, method },
      { $inc: { successCount: 1, successAmount: payment.amount } },
      { upsert: true }
    );
    await FunnelDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { paymentSuccess: 1 } }, { upsert: true });
  } else if (eventType === EVENT_TYPES.PAYMENT_FAILED) {
    await bumpSales(dateKey, { failedPaymentAmount: payment.amount });
    await PaymentDailyMetric.findOneAndUpdate(
      { dateKey, provider: payment.provider, method },
      { $inc: { failedCount: 1 } },
      { upsert: true }
    );
  }
}

async function handleRefundCompleted({ orderId }) {
  const payment = await Payment.findOne({ order: orderId }).sort({ createdAt: -1 });
  if (!payment) return;
  const dateKey = toDateKey(new Date());
  await bumpSales(dateKey, { refundAmount: payment.refundedAmount, refundedCount: 1 });
  await PaymentDailyMetric.findOneAndUpdate(
    { dateKey, provider: payment.provider, method: payment.method || "unknown" },
    { $inc: { refundCount: 1, refundAmount: payment.refundedAmount } },
    { upsert: true }
  );
}

async function handleShipmentCreated({ orderId }) {
  const shipment = await Shipment.findOne({ order: orderId }).sort({ createdAt: -1 });
  if (!shipment) return;
  const dateKey = toDateKey(shipment.createdAt);
  await ShippingDailyMetric.findOneAndUpdate(
    { dateKey },
    { $inc: { shipmentsCreated: 1, shippingCostTotal: shipment.carrierShippingCost || 0 } },
    { upsert: true }
  );
}

async function handleOrderDelivered({ orderId }) {
  const shipment = await Shipment.findOne({ order: orderId }).sort({ createdAt: -1 });
  if (!shipment || !shipment.deliveredAt || !shipment.shippedAt) return;
  const dateKey = toDateKey(shipment.deliveredAt);
  const hours = (shipment.deliveredAt - shipment.shippedAt) / (1000 * 60 * 60);
  const metric = await ShippingDailyMetric.findOneAndUpdate(
    { dateKey },
    { $inc: { delivered: 1, deliveryTimeSumHours: hours, deliveryTimeCount: 1 } },
    { upsert: true, new: true }
  );
  metric.pushSample(hours);
  await metric.save();
}

// Called once at boot (app.js), same pattern as notificationEngine.registerEngine().
export function registerAnalyticsWorker() {
  subscribe(EVENT_TYPES.ORDER_CREATED, handleOrderCreated);
  subscribe(EVENT_TYPES.ORDER_CANCELLED, handleOrderCancelled);
  subscribe(EVENT_TYPES.PAYMENT_SUCCESSFUL, (payload) => handlePaymentEvent(EVENT_TYPES.PAYMENT_SUCCESSFUL, payload));
  subscribe(EVENT_TYPES.PAYMENT_FAILED, (payload) => handlePaymentEvent(EVENT_TYPES.PAYMENT_FAILED, payload));
  subscribe(EVENT_TYPES.REFUND_COMPLETED, handleRefundCompleted);
  subscribe(EVENT_TYPES.SHIPMENT_CREATED, handleShipmentCreated);
  subscribe(EVENT_TYPES.ORDER_DELIVERED, handleOrderDelivered);
}

// Behavioral (client-instrumented) event handling — funnel + product views.
// Visitor de-duplication uses VisitorDaily (see that model's comment) so
// FunnelDailyMetric.visitors stays an exact distinct count, not a running
// counter that can't tell new-today from already-counted.
export async function processBehavioralEvent(event) {
  const dateKey = toDateKey(event.timestamp);
  const visitorKey = event.userId ? `user:${event.userId}` : `anon:${event.anonymousId}`;

  try {
    await VisitorDaily.create({ dateKey, visitorKey });
    await FunnelDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { visitors: 1 } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err; // already counted as a visitor today — not an error
  }

  const FUNNEL_FIELD = {
    PRODUCT_VIEW: "productViews",
    ADD_TO_CART: "addToCart",
    CHECKOUT_STARTED: "checkoutStarted",
    PAYMENT_STARTED: "paymentAttempt",
  }[event.eventType];
  if (FUNNEL_FIELD) {
    await FunnelDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { [FUNNEL_FIELD]: 1 } }, { upsert: true });
  }

  if (event.eventType === "PRODUCT_VIEW" && event.properties?.productId) {
    const product = await Product.findById(event.properties.productId, "category").catch(() => null);
    await ProductDailyMetric.findOneAndUpdate(
      { dateKey, product: event.properties.productId },
      { $inc: { views: 1 } },
      { upsert: true }
    ).catch(() => {}); // a bad/deleted productId in client-reported properties must never break ingestion
    void product;
  }
  if (event.eventType === "ADD_TO_CART" && event.properties?.productId) {
    await ProductDailyMetric.findOneAndUpdate(
      { dateKey, product: event.properties.productId },
      { $inc: { addToCart: 1 } },
      { upsert: true }
    ).catch(() => {});
  }

  invalidatePrefix(`funnel:${dateKey.slice(0, 7)}`);
}
