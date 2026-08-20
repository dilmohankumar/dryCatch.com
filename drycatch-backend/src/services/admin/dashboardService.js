import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import Inventory from "../../models/Inventory.js";
import AdminAuditLog from "../../models/AdminAuditLog.js";
import Review from "../../models/Review.js";
import { getZeroResultRate, getTopQueries } from "../search/searchAnalyticsService.js";

const RANGE_DAYS = { today: 1, yesterday: 1, "7d": 7, "30d": 30, "90d": 90 };

function resolveRange(range = "30d") {
  const now = new Date();
  const days = RANGE_DAYS[range] || 30;
  const from = new Date(now.getTime() - days * 86400000);
  const prevFrom = new Date(from.getTime() - days * 86400000);
  return { from, to: now, prevFrom, prevTo: from };
}

// One revenue+order aggregation, reused for both the current and the
// comparison period (rule #17/#87/#88) — never "load every order into
// Node and sum in JavaScript." Only paid orders count as revenue,
// matching Payment.status's own authority (Phase 8) rather than Order's
// coarser business-lifecycle status.
async function revenueAndOrders(from, to) {
  const [result] = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lt: to }, paymentStatus: "succeeded" } },
    { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 }, discounts: { $sum: "$discountAmount" }, tax: { $sum: "$taxAmount" }, shipping: { $sum: "$shippingCost" } } },
  ]);
  return result || { revenue: 0, orders: 0, discounts: 0, tax: 0, shipping: 0 };
}

function growth(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// GET /admin/dashboard — one aggregated call (rule #86/#87), not the
// frontend firing a dozen requests to render the first screen. Each
// section is its own independent query so a slow one doesn't block the
// others (rule #151) — Promise.all runs them concurrently, and a
// dashboard consumer can render each card as its own error-isolated
// component (rule #154) using the per-section result.
export async function getDashboard({ range = "30d" } = {}) {
  const { from, to, prevFrom, prevTo } = resolveRange(range);

  const [
    current, previous, newCustomers, prevNewCustomers,
    productCounts, lowStock, topProducts, recentOrders, recentActivity,
    pendingReviews, zeroResultRate, topQueries,
  ] = await Promise.all([
    revenueAndOrders(from, to),
    revenueAndOrders(prevFrom, prevTo),
    User.countDocuments({ role: "customer", createdAt: { $gte: from, $lt: to } }),
    User.countDocuments({ role: "customer", createdAt: { $gte: prevFrom, $lt: prevTo } }),
    Product.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Inventory.aggregate([
      { $addFields: { available: { $subtract: ["$quantityOnHand", "$quantityReserved"] } } },
      { $match: { status: "active", $expr: { $lte: ["$available", "$reorderLevel"] } } },
      { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
      { $unwind: "$variant" },
      { $project: { sku: "$variant.sku", available: 1, reorderLevel: 1 } },
      { $limit: 20 },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to }, paymentStatus: "succeeded" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.name" }, unitsSold: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(10).select("orderNumber user totalAmount status paymentStatus createdAt").populate("user", "firstName lastName"),
    AdminAuditLog.find().sort({ createdAt: -1 }).limit(15).populate("actor", "firstName lastName"),
    Review.countDocuments({ status: "pending" }),
    getZeroResultRate({ days: RANGE_DAYS[range] || 30 }),
    getTopQueries({ days: RANGE_DAYS[range] || 30, limit: 5 }),
  ]);

  const avgOrderValue = current.orders ? Math.round((current.revenue / current.orders) * 100) / 100 : 0;
  const prevAvgOrderValue = previous.orders ? Math.round((previous.revenue / previous.orders) * 100) / 100 : 0;

  return {
    range,
    kpis: {
      revenue: { value: current.revenue, growth: growth(current.revenue, previous.revenue) },
      orders: { value: current.orders, growth: growth(current.orders, previous.orders) },
      newCustomers: { value: newCustomers, growth: growth(newCustomers, prevNewCustomers) },
      averageOrderValue: { value: avgOrderValue, growth: growth(avgOrderValue, prevAvgOrderValue) },
    },
    revenueBreakdown: {
      grossSales: Math.round((current.revenue + current.discounts) * 100) / 100,
      discounts: current.discounts,
      shipping: current.shipping,
      tax: current.tax,
      netRevenue: current.revenue,
    },
    products: {
      byStatus: Object.fromEntries(productCounts.map((p) => [p._id, p.count])),
    },
    lowStock,
    topProducts,
    recentOrders,
    recentActivity,
    pendingReviewCount: pendingReviews,
    search: { zeroResultRate: zeroResultRate.rate, topQueries: topQueries.map((q) => q._id) },
  };
}
