import { getOverview } from "../../services/analytics/overviewAnalyticsService.js";
import { getSalesAnalytics } from "../../services/analytics/salesAnalyticsService.js";
import { getOrderStatusDistribution } from "../../services/analytics/orderAnalyticsService.js";
import { getCustomerAnalytics, getCustomerLifetimeValue, getRetention } from "../../services/analytics/customerAnalyticsService.js";
import { getTopProducts } from "../../services/analytics/productAnalyticsService.js";
import { getTopCategories } from "../../services/analytics/categoryAnalyticsService.js";
import { getInventoryAnalytics, getLowStockAndOutOfStock } from "../../services/analytics/inventoryAnalyticsService.js";
import { getPaymentAnalytics } from "../../services/analytics/paymentAnalyticsService.js";
import { getShippingAnalytics } from "../../services/analytics/shippingAnalyticsService.js";
import { getCouponPerformance } from "../../services/analytics/discountAnalyticsService.js";
import { getReviewAnalytics } from "../../services/analytics/reviewAnalyticsService.js";
import { getSearchAnalytics } from "../../services/analytics/searchAnalyticsService.js";
import { getFunnelAnalytics } from "../../services/analytics/funnelAnalyticsService.js";
import { getCohortMatrix } from "../../services/analytics/cohortAnalyticsService.js";
import * as notificationAnalyticsService from "../../services/notifications/analyticsService.js"; // reused from Phase 16, not duplicated
import * as exportService from "../../services/analytics/exportService.js";
import * as reportService from "../../services/analytics/reportService.js";
import * as reconciliationService from "../../services/analytics/reconciliationService.js";
import * as rebuildService from "../../services/analytics/rebuildService.js";
import { dateKeysBetween, resolveDateRange } from "../../utils/dateRange.js";
import { logAuditEvent } from "../../utils/auditLog.js";

// Every function here reads its scope from req.user (RBAC middleware
// already gated the route) — never from a client-supplied tenantId/storeId
// (rule #103). This project is single-tenant today (documented throughout
// every phase), so there is one implicit scope, but no handler trusts a
// body/query "tenantId" field even so.

export async function overview(req, res) {
  res.json(await getOverview(req.query));
}
export async function sales(req, res) {
  res.json(await getSalesAnalytics(req.query));
}
export async function revenue(req, res) {
  res.json(await getSalesAnalytics(req.query)); // revenue and sales share one metric definition set (rule #10) — same underlying data, presented via the same endpoint
}
export async function orders(req, res) {
  res.json(await getOrderStatusDistribution(req.query));
}
export async function customers(req, res) {
  res.json(await getCustomerAnalytics(req.query));
}
export async function customerLifetimeValue(req, res) {
  res.json(await getCustomerLifetimeValue());
}
export async function retention(req, res) {
  res.json(await getRetention(req.query));
}
export async function products(req, res) {
  res.json(await getTopProducts(req.query));
}
export async function categories(req, res) {
  res.json(await getTopCategories(req.query));
}
export async function inventory(req, res) {
  res.json(await getInventoryAnalytics());
}
export async function lowStock(req, res) {
  res.json(await getLowStockAndOutOfStock(req.query));
}
export async function payments(req, res) {
  res.json(await getPaymentAnalytics(req.query));
}
export async function shipping(req, res) {
  res.json(await getShippingAnalytics(req.query));
}
export async function discounts(req, res) {
  res.json(await getCouponPerformance(req.query));
}
export async function reviews(req, res) {
  res.json(await getReviewAnalytics(req.query));
}
export async function search(req, res) {
  res.json(await getSearchAnalytics(req.query));
}
export async function notifications(req, res) {
  const range = resolveDateRange(req.query);
  const [deliveryStats, queueHealth] = await Promise.all([
    notificationAnalyticsService.getDeliveryStats({ since: range.startDate }),
    notificationAnalyticsService.getQueueHealth(),
  ]);
  res.json({ deliveryStats, queueHealth, meta: { startDate: range.startDate, endDate: range.endDate } });
}
export async function funnel(req, res) {
  res.json(await getFunnelAnalytics(req.query));
}
export async function cohorts(req, res) {
  res.json(await getCohortMatrix(req.query));
}

// Exports
export async function requestExport(req, res) {
  const job = await exportService.requestExport(req.body, req.user._id);
  logAuditEvent("ANALYTICS_EXPORT_REQUESTED", req.user._id, { jobId: String(job._id), type: job.type });
  res.status(201).json({ id: job._id, status: job.status, downloadToken: job.downloadToken, rowCount: job.rowCount, expiresAt: job.expiresAt });
}
export async function getExportStatus(req, res) {
  const job = await exportService.getExportJob(req.params.id, req.user._id);
  res.json({ id: job._id, status: job.status, rowCount: job.rowCount, error: job.error, expiresAt: job.expiresAt });
}
export async function downloadExport(req, res) {
  const job = await exportService.downloadExport(req.params.id, req.query.token);
  logAuditEvent("ANALYTICS_EXPORT_DOWNLOADED", req.user?._id, { jobId: String(job._id) });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${job.type}-export.csv"`);
  res.send(job.fileContent);
}

// Reports
export async function createReport(req, res) {
  res.status(201).json(await reportService.createReport(req.body, req.user._id));
}
export async function listReports(req, res) {
  res.json({ reports: await reportService.listReports() });
}
export async function runReport(req, res) {
  const result = await reportService.runReport(req.params.id);
  logAuditEvent("ANALYTICS_REPORT_GENERATED", req.user._id, { reportId: req.params.id });
  res.json(result);
}

// Reconciliation + rebuild (rule #71/#72/#116) — deliberately gated by a
// SEPARATE permission (analytics.rebuild) in the route layer, not just
// analytics.read.
export async function reconcile(req, res) {
  const range = resolveDateRange(req.query);
  const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
  res.json(await reconciliationService.reconcileRange(dateKeys));
}
export async function rebuild(req, res) {
  const range = resolveDateRange(req.query);
  const dateKeys = dateKeysBetween(range.startDate, range.endDate, range.timezoneOffsetMinutes);
  if (dateKeys.length > 366) {
    return res.status(400).json({ message: "Rebuild range cannot exceed 366 days per request", code: "REBUILD_RANGE_TOO_LARGE" });
  }
  logAuditEvent("ANALYTICS_REBUILD_STARTED", req.user._id, { startDate: range.startDate, endDate: range.endDate, dayCount: dateKeys.length });
  const summary = await rebuildService.rebuildRange(dateKeys);
  logAuditEvent("ANALYTICS_REBUILD_COMPLETED", req.user._id, summary);
  res.json(summary);
}
