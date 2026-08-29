import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import LineChart from "../../../components/analytics/LineChart.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsSales() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminAnalyticsAPI.sales(range).then(setData).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [range]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const job = await adminAnalyticsAPI.requestExport({ type: "sales", filters: range });
      if (job.status === "completed") window.open(adminAnalyticsAPI.downloadExportUrl(job.id, job.downloadToken), "_blank");
      else setError("Export failed to generate.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales & Revenue</h1>
        <div className="flex items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={handleExport} disabled={exporting} className="bg-white border border-gray-300 text-gray-700 text-sm font-bold px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Gross Sales" value={data.summary.grossSales} changePercent={undefined} format="currency" />
            <MetricCard label="Net Sales" value={data.summary.netSales} changePercent={data.comparison.changePercent.netSales} format="currency" />
            <MetricCard label="Orders" value={data.summary.ordersCount} changePercent={data.comparison.changePercent.ordersCount} />
            <MetricCard label="Average Order Value" value={data.summary.averageOrderValue} changePercent={data.comparison.changePercent.averageOrderValue} format="currency" />
            <MetricCard label="Discounts" value={data.summary.discountAmount} format="currency" />
            <MetricCard label="Refunds" value={data.summary.refundAmount} format="currency" inverse />
            <MetricCard label="Tax Collected" value={data.summary.taxAmount} format="currency" />
            <MetricCard label="Units Sold" value={data.summary.unitsSold} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Net Sales Over Time</h2>
            <LineChart series={data.data.map((d) => ({ x: d.date, y: d.netSales }))} valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`} />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Orders Over Time</h2>
            <LineChart series={data.data.map((d) => ({ x: d.date, y: d.ordersCount }))} color="#F4B740" />
          </div>
        </>
      )}
    </div>
  );
}
