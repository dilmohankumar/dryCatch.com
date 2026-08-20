import crypto from "crypto";
import AnalyticsExportJob from "../../models/AnalyticsExportJob.js";
import { toCSV } from "../../utils/csvExport.js";
import { getSalesAnalytics } from "./salesAnalyticsService.js";
import { getTopProducts } from "./productAnalyticsService.js";
import { getCustomerAnalytics } from "./customerAnalyticsService.js";
import { getCouponPerformance } from "./discountAnalyticsService.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const EXPORT_BUILDERS = {
  sales: async (filters) => {
    const res = await getSalesAnalytics(filters);
    return { rows: res.data, columns: [{ label: "Date", value: "date" }, { label: "Gross Sales", value: "grossSales" }, { label: "Net Sales", value: "netSales" }, { label: "Orders", value: "ordersCount" }, { label: "Units Sold", value: "unitsSold" }, { label: "AOV", value: "averageOrderValue" }, { label: "Refunds", value: "refundAmount" }] };
  },
  products: async (filters) => {
    const res = await getTopProducts({ ...filters, limit: 500 });
    return { rows: res.data, columns: [{ label: "Product", value: "name" }, { label: "Views", value: "views" }, { label: "Add to Cart", value: "addToCart" }, { label: "Purchases", value: "purchases" }, { label: "Units Sold", value: "unitsSold" }, { label: "Revenue", value: "revenue" }, { label: "Conversion Rate", value: (r) => (r.conversionRate * 100).toFixed(2) + "%" }] };
  },
  customers: async (filters) => {
    const res = await getCustomerAnalytics(filters);
    return { rows: res.data, columns: [{ label: "Date", value: "date" }, { label: "New Customers", value: "newCustomers" }, { label: "Returning Customers", value: "returningCustomers" }, { label: "New Customer Revenue", value: "newCustomerRevenue" }, { label: "Returning Customer Revenue", value: "returningCustomerRevenue" }] };
  },
  coupons: async (filters) => {
    const res = await getCouponPerformance(filters);
    return { rows: res.data, columns: [{ label: "Coupon", value: "couponCode" }, { label: "Usage", value: "usageCount" }, { label: "Discount Amount", value: "discountAmount" }, { label: "Revenue", value: "revenue" }, { label: "AOV", value: "averageOrderValue" }] };
  },
};

// Async export lifecycle (rule #81/#82) — modeled with pending/processing/
// completed states even though there's no real queue to hand this off to
// yet (Phase 16's honest-scope precedent). `downloadToken` is the actual
// authorization check on download, not just the job's Mongo _id (rule #82
// — short-lived, unguessable access).
export async function requestExport({ type, filters = {}, format = "csv" }, requestedBy) {
  if (!EXPORT_BUILDERS[type]) fail(`Unknown export type "${type}"`, "INVALID_EXPORT_TYPE", 400);
  if (format !== "csv") fail("Only CSV export is implemented — Excel/PDF are documented as not built (rule #145)", "FORMAT_NOT_SUPPORTED", 400);

  const job = await AnalyticsExportJob.create({
    type, format, filters, requestedBy,
    status: "processing",
    downloadToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h download window
  });

  try {
    const { rows, columns } = await EXPORT_BUILDERS[type](filters);
    job.fileContent = toCSV(rows, columns);
    job.rowCount = rows.length;
    job.status = "completed";
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
  }
  await job.save();
  return job;
}

export async function getExportJob(id, requestedBy) {
  const job = await AnalyticsExportJob.findOne({ _id: id, requestedBy });
  if (!job) fail("Export job not found", "EXPORT_NOT_FOUND");
  return job;
}

export async function downloadExport(id, token) {
  const job = await AnalyticsExportJob.findById(id);
  if (!job || job.downloadToken !== token) fail("Export not found or link invalid", "EXPORT_NOT_FOUND"); // constant-shape response either way — never reveal which
  if (job.expiresAt < new Date()) fail("This export link has expired", "EXPORT_EXPIRED", 410);
  if (job.status !== "completed") fail("Export is not ready", "EXPORT_NOT_READY", 409);
  return job;
}
