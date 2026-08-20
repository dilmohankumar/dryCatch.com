import AnalyticsReport from "../../models/AnalyticsReport.js";
import User from "../../models/User.js";
import { getSalesAnalytics } from "./salesAnalyticsService.js";
import { getTopProducts } from "./productAnalyticsService.js";
import { getCustomerAnalytics } from "./customerAnalyticsService.js";
import { getInventoryAnalytics } from "./inventoryAnalyticsService.js";
import { getPaymentAnalytics } from "./paymentAnalyticsService.js";
import { getShippingAnalytics } from "./shippingAnalyticsService.js";
import { getCouponPerformance } from "./discountAnalyticsService.js";
import * as eventBus from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const REPORT_BUILDERS = {
  daily_sales: (filters) => getSalesAnalytics({ ...filters, period: filters.period || "yesterday" }),
  monthly_sales: (filters) => getSalesAnalytics({ ...filters, period: filters.period || "lastMonth" }),
  product_performance: (filters) => getTopProducts({ ...filters, limit: 20 }),
  customer: (filters) => getCustomerAnalytics(filters),
  inventory: () => getInventoryAnalytics(),
  payment: (filters) => getPaymentAnalytics(filters),
  shipping: (filters) => getShippingAnalytics(filters),
  discount: (filters) => getCouponPerformance(filters),
};

export async function createReport(data, actorId) {
  if (!REPORT_BUILDERS[data.type]) fail(`Unknown report type "${data.type}"`, "INVALID_REPORT_TYPE", 400);
  return AnalyticsReport.create({ ...data, createdBy: actorId });
}

export async function listReports() {
  return AnalyticsReport.find().sort({ createdAt: -1 }).populate("recipients", "firstName lastName email");
}

// No real scheduler exists (consistent honest-scope note across every
// phase) — a report "runs" only when this is called, whether that's an
// admin clicking "Run Now" or a future cron hitting the same function.
export async function runReport(reportId) {
  const report = await AnalyticsReport.findById(reportId).populate("recipients");
  if (!report) fail("Report not found", "REPORT_NOT_FOUND");

  const builder = REPORT_BUILDERS[report.type];
  if (!builder) fail(`No builder registered for report type "${report.type}"`, "INVALID_REPORT_TYPE", 400);

  try {
    const data = await builder({});
    report.lastRunAt = new Date();
    report.lastStatus = "success";
    report.lastError = undefined;
    await report.save();

    // Recipients are validated as real admin users at generation time
    // (rule #85), not trusted from whatever was stored when the report was
    // created (an admin could have been deactivated since).
    const validRecipients = await User.find({ _id: { $in: report.recipients.map((r) => r._id) }, role: "admin" }, "_id");
    for (const recipient of validRecipients) {
      await eventBus.publish(
        EVENT_TYPES.REPORT_READY,
        { userId: String(recipient._id), reportId: String(report._id), reportName: report.name, reportType: report.type },
        { source: "analytics" }
      );
    }

    return { report, data };
  } catch (err) {
    report.lastRunAt = new Date();
    report.lastStatus = "failed";
    report.lastError = err.message;
    await report.save();
    throw err;
  }
}
