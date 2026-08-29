import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import DataTable from "../../../components/analytics/DataTable.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsPayments() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminAnalyticsAPI.payments(range).then(setData).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Successful Payments" value={data.summary.successCount} />
            <MetricCard label="Failed Payments" value={data.summary.failedCount} inverse />
            <MetricCard label="Success Rate" value={data.summary.successRate} format="percent" />
            <MetricCard label="Refunds" value={data.summary.refundAmount} format="currency" inverse />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">By Method</h2>
              <DataTable
                columns={[
                  { key: "method", label: "Method" },
                  { key: "successCount", label: "Success" },
                  { key: "failedCount", label: "Failed" },
                  { key: "successRate", label: "Success Rate", render: (r) => `${(r.successRate * 100).toFixed(1)}%` },
                ]}
                rows={data.byMethod}
                emptyMessage="No payment activity"
              />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">By Provider</h2>
              <DataTable
                columns={[
                  { key: "provider", label: "Provider" },
                  { key: "successCount", label: "Success" },
                  { key: "failedCount", label: "Failed" },
                  { key: "successRate", label: "Success Rate", render: (r) => `${(r.successRate * 100).toFixed(1)}%` },
                ]}
                rows={data.byProvider}
                emptyMessage="No payment activity"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
