import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import Shipment from "../../models/Shipment.js";
import DailySalesMetric from "../../models/DailySalesMetric.js";
import ProductDailyMetric from "../../models/ProductDailyMetric.js";
import CategoryDailyMetric from "../../models/CategoryDailyMetric.js";
import CustomerDailyMetric from "../../models/CustomerDailyMetric.js";
import PaymentDailyMetric from "../../models/PaymentDailyMetric.js";
import ShippingDailyMetric from "../../models/ShippingDailyMetric.js";
import DiscountDailyMetric from "../../models/DiscountDailyMetric.js";
import { toDateKey, dateKeyToUtcRange } from "../../utils/businessDate.js";
import { invalidatePrefix } from "../../utils/analyticsCache.js";

// The rebuild path (rule #72/#116) — recomputes aggregates FROM THE SOURCE
// OF TRUTH (Order/Payment/Shipment), never from AnalyticsEvent (which only
// exists going forward from this phase's deployment, so it can't
// reconstruct pre-Phase-17 history). This is also what a fresh production
// deployment's backfill (rule #124) runs for all pre-existing orders.
// Protected by `analytics.rebuild` — a distinct, higher permission than
// ordinary analytics read/export (rule #116: "protect with high-level
// permissions").
export async function rebuildRange(dateKeys, { onProgress } = {}) {
  const summary = { daysProcessed: 0, ordersProcessed: 0 };

  for (const dateKey of dateKeys) {
    const { start, end } = dateKeyToUtcRange(dateKey);

    await Promise.all([
      DailySalesMetric.deleteOne({ dateKey }),
      ProductDailyMetric.deleteMany({ dateKey }),
      CategoryDailyMetric.deleteMany({ dateKey }),
      CustomerDailyMetric.deleteOne({ dateKey }),
      PaymentDailyMetric.deleteMany({ dateKey }),
      ShippingDailyMetric.deleteOne({ dateKey }),
      DiscountDailyMetric.deleteMany({ dateKey }),
    ]);

    const orders = await Order.find({ createdAt: { $gte: start, $lt: end } }).populate("items.product", "category");
    for (const order of orders) {
      await rebuildOrder(dateKey, order);
      summary.ordersProcessed++;
    }

    const payments = await Payment.find({ updatedAt: { $gte: start, $lt: end }, status: { $in: ["succeeded", "failed"] } });
    for (const payment of payments) await rebuildPayment(dateKey, payment);

    const shipments = await Shipment.find({ createdAt: { $gte: start, $lt: end } });
    for (const shipment of shipments) {
      await ShippingDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { shipmentsCreated: 1, shippingCostTotal: shipment.carrierShippingCost || 0 } }, { upsert: true });
    }
    const delivered = await Shipment.find({ deliveredAt: { $gte: start, $lt: end }, shippedAt: { $ne: null } });
    for (const shipment of delivered) {
      const hours = (shipment.deliveredAt - shipment.shippedAt) / (1000 * 60 * 60);
      const metric = await ShippingDailyMetric.findOneAndUpdate({ dateKey }, { $inc: { delivered: 1, deliveryTimeSumHours: hours, deliveryTimeCount: 1 } }, { upsert: true, new: true });
      metric.pushSample(hours);
      await metric.save();
    }

    summary.daysProcessed++;
    invalidatePrefix(""); // rebuild invalidates everything cached — correctness over cache efficiency here
    if (onProgress) onProgress({ dateKey, ...summary });
  }

  return summary;
}

async function rebuildOrder(dateKey, order) {
  await DailySalesMetric.findOneAndUpdate(
    { dateKey },
    {
      $inc: {
        grossSales: order.subtotal || 0,
        discountAmount: order.discountAmount || 0,
        taxAmount: order.taxAmount || 0,
        shippingRevenue: order.shippingCost || 0,
        ordersCount: 1,
        unitsSold: order.items.reduce((sum, i) => sum + i.quantity, 0),
        cancelledCount: order.status === "cancelled" ? 1 : 0,
        refundedCount: order.status === "refunded" ? 1 : 0,
      },
    },
    { upsert: true }
  );

  for (const item of order.items) {
    const lineRevenue = (item.price || 0) * item.quantity;
    await ProductDailyMetric.findOneAndUpdate(
      { dateKey, product: item.product?._id || item.product },
      { $inc: { purchases: 1, unitsSold: item.quantity, revenue: lineRevenue } },
      { upsert: true }
    );
    const categoryId = item.product?.category;
    if (categoryId) {
      await CategoryDailyMetric.findOneAndUpdate({ dateKey, category: categoryId }, { $inc: { orders: 1, units: item.quantity, revenue: lineRevenue } }, { upsert: true });
    }
  }

  const priorOrders = await Order.countDocuments({ user: order.user, createdAt: { $lt: order.createdAt } });
  const isNew = priorOrders === 0;
  await CustomerDailyMetric.findOneAndUpdate(
    { dateKey },
    { $inc: isNew ? { newCustomers: 1, newCustomerRevenue: order.totalAmount } : { returningCustomers: 1, returningCustomerRevenue: order.totalAmount } },
    { upsert: true }
  );

  if (order.couponCode) {
    await DiscountDailyMetric.findOneAndUpdate(
      { dateKey, couponCode: order.couponCode },
      { $inc: { usageCount: 1, discountAmount: order.discountAmount || 0, revenue: order.totalAmount || 0 } },
      { upsert: true }
    );
  }
}

async function rebuildPayment(dateKey, payment) {
  const method = payment.method || "unknown";
  if (payment.status === "succeeded") {
    await DailySalesMetric.findOneAndUpdate({ dateKey }, { $inc: { paidRevenue: payment.amount } }, { upsert: true });
    await PaymentDailyMetric.findOneAndUpdate({ dateKey, provider: payment.provider, method }, { $inc: { successCount: 1, successAmount: payment.amount } }, { upsert: true });
    if (payment.refundedAmount > 0) {
      await DailySalesMetric.findOneAndUpdate({ dateKey }, { $inc: { refundAmount: payment.refundedAmount } }, { upsert: true });
      await PaymentDailyMetric.findOneAndUpdate({ dateKey, provider: payment.provider, method }, { $inc: { refundCount: 1, refundAmount: payment.refundedAmount } }, { upsert: true });
    }
  } else if (payment.status === "failed") {
    await DailySalesMetric.findOneAndUpdate({ dateKey }, { $inc: { failedPaymentAmount: payment.amount } }, { upsert: true });
    await PaymentDailyMetric.findOneAndUpdate({ dateKey, provider: payment.provider, method }, { $inc: { failedCount: 1 } }, { upsert: true });
  }
}

export { toDateKey };
