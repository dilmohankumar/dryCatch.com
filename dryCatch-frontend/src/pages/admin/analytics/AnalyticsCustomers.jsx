import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import LineChart from "../../../components/analytics/LineChart.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsCustomers() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [clv, setClv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([adminAnalyticsAPI.customers(range), adminAnalyticsAPI.customerLTV()])
      .then(([c, l]) => { setData(c); setClv(l); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && clv && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Customers" value={data.summary.totalCustomers} />
            <MetricCard label="New Customers" value={data.summary.newCustomers} />
            <MetricCard label="Returning Customers" value={data.summary.returningCustomers} />
            <MetricCard label="Active Customers" value={data.summary.activeCustomers} />
            <MetricCard label="Repeat Purchase Rate" value={data.summary.repeatPurchaseRate} format="percent" />
            <MetricCard label="Historical CLV" value={clv.historicalCLV} format="currency" />
            <MetricCard label="Avg Orders / Customer" value={clv.averageOrdersPerCustomer} />
          </div>
          {clv.predictiveCLV === null && (
            <p className="text-xs text-gray-400 mb-6">
              Predictive CLV and Cohort CLV are not shown — this project has no statistical projection model for future spend (documented gap, see docs/analytics.md).
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">New Customers Over Time</h2>
              <LineChart series={data.data.map((d) => ({ x: d.date, y: d.newCustomers }))} />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Returning Customers Over Time</h2>
              <LineChart series={data.data.map((d) => ({ x: d.date, y: d.returningCustomers }))} color="#F4B740" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
