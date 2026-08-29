import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import DataTable from "../../../components/analytics/DataTable.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsDiscounts() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminAnalyticsAPI.discounts(range).then(setData).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Discounts & Coupons</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <MetricCard label="Coupon Redemptions" value={data.summary.usageCount} />
            <MetricCard label="Total Discount Given" value={data.summary.discountAmount} format="currency" inverse />
            <MetricCard label="Revenue from Discounted Orders" value={data.summary.revenue} format="currency" />
          </div>
          <DataTable
            columns={[
              { key: "couponCode", label: "Coupon", sortable: true },
              { key: "usageCount", label: "Usage", sortable: true },
              { key: "discountAmount", label: "Discount Cost", sortable: true, render: (r) => `₹${r.discountAmount.toLocaleString("en-IN")}` },
              { key: "revenue", label: "Revenue", sortable: true, render: (r) => `₹${r.revenue.toLocaleString("en-IN")}` },
              { key: "averageOrderValue", label: "AOV", render: (r) => `₹${r.averageOrderValue.toLocaleString("en-IN")}` },
            ]}
            rows={data.data}
            getRowKey={(r) => r.couponCode}
            emptyMessage="No coupons used in this period"
          />
        </>
      )}
    </div>
  );
}
