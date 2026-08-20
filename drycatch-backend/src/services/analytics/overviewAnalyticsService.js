import { getSalesAnalytics } from "./salesAnalyticsService.js";
import { getOrderStatusDistribution } from "./orderAnalyticsService.js";
import { getCustomerAnalytics } from "./customerAnalyticsService.js";
import { getTopProducts } from "./productAnalyticsService.js";
import { getTopCategories } from "./categoryAnalyticsService.js";
import { getInventoryAnalytics, getLowStockAndOutOfStock } from "./inventoryAnalyticsService.js";
import { getPaymentAnalytics } from "./paymentAnalyticsService.js";
import { getFunnelAnalytics } from "./funnelAnalyticsService.js";
import { conversionRate } from "./metricService.js";
import Order from "../../models/Order.js";

// ONE endpoint composing the KPI cards the dashboard's first paint needs
// (rule #100 — "must not make 20+ independent API requests on every page
// load"). Everything here runs in parallel server-side rather than the
// frontend firing 8 separate fetches.
export async function getOverview(query) {
  const [sales, orderStatus, customers, topProducts, topCategories, inventory, lowStock, payments, funnel, recentOrders] = await Promise.all([
    getSalesAnalytics(query),
    getOrderStatusDistribution(query),
    getCustomerAnalytics(query),
    getTopProducts({ ...query, limit: 5, sortBy: "revenue" }),
    getTopCategories({ ...query, limit: 5 }),
    getInventoryAnalytics(),
    getLowStockAndOutOfStock({ limit: 10 }),
    getPaymentAnalytics(query),
    getFunnelAnalytics(query),
    Order.find().sort({ createdAt: -1 }).limit(10).select("orderNumber status totalAmount createdAt user").populate("user", "firstName lastName email").lean(),
  ]);

  return {
    kpis: {
      revenue: sales.summary.netSales,
      revenueChangePercent: sales.comparison.changePercent.netSales,
      orders: sales.summary.ordersCount,
      ordersChangePercent: sales.comparison.changePercent.ordersCount,
      averageOrderValue: sales.summary.averageOrderValue,
      customers: customers.summary.newCustomers + customers.summary.returningCustomers,
      conversionRate: conversionRate({ visitors: funnel.stages[0]?.count, orderCompleted: funnel.stages.at(-1)?.count }),
      refunds: sales.summary.refundAmount,
      discounts: sales.summary.discountAmount,
    },
    orderStatusDistribution: orderStatus.data,
    topProducts: topProducts.data,
    topCategories: topCategories.data,
    inventory: inventory.summary,
    lowStockAlerts: lowStock.data,
    paymentFailures: payments.summary.failedCount,
    recentOrders,
    meta: sales.meta,
  };
}
