import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import DataTable from "../../../components/analytics/DataTable.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

// ONE composed endpoint (rule #100) drives this whole page — no client-side
// fan-out of 8+ requests on load.
export default function AnalyticsOverview() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminAnalyticsAPI
      .overview(range)
      .then(setData)
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Revenue (Net)" value={data.kpis.revenue} changePercent={data.kpis.revenueChangePercent} format="currency" />
            <MetricCard label="Orders" value={data.kpis.orders} changePercent={data.kpis.ordersChangePercent} />
            <MetricCard label="Average Order Value" value={data.kpis.averageOrderValue} format="currency" />
            <MetricCard label="New + Returning Customers" value={data.kpis.customers} />
            <MetricCard label="Conversion Rate" value={data.kpis.conversionRate} format="percent" />
            <MetricCard label="Refunds" value={data.kpis.refunds} format="currency" inverse />
            <MetricCard label="Discounts Given" value={data.kpis.discounts} format="currency" />
            <MetricCard label="Payment Failures" value={data.paymentFailures} inverse />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Top Products</h2>
              <DataTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "revenue", label: "Revenue", render: (r) => `₹${r.revenue.toLocaleString("en-IN")}` },
                  { key: "unitsSold", label: "Units" },
                ]}
                rows={data.topProducts}
                emptyMessage="No product sales yet"
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Top Categories</h2>
              <DataTable
                columns={[
                  { key: "name", label: "Category" },
                  { key: "revenue", label: "Revenue", render: (r) => `₹${r.revenue.toLocaleString("en-IN")}` },
                  { key: "orders", label: "Orders" },
                ]}
                rows={data.topCategories}
                emptyMessage="No category sales yet"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Low Stock Alerts</h2>
              <DataTable
                columns={[
                  { key: "productName", label: "Product" },
                  { key: "sku", label: "SKU" },
                  { key: "available", label: "Available" },
                ]}
                rows={data.lowStockAlerts}
                emptyMessage="Nothing low on stock"
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Recent Orders</h2>
              <DataTable
                columns={[
                  { key: "orderNumber", label: "Order" },
                  { key: "status", label: "Status" },
                  { key: "totalAmount", label: "Total", render: (r) => `₹${r.totalAmount.toLocaleString("en-IN")}` },
                ]}
                rows={data.recentOrders}
                emptyMessage="No orders yet"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
