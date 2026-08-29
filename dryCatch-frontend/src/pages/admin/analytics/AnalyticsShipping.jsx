import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsShipping() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminAnalyticsAPI.shipping(range).then(setData).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shipping</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            <MetricCard label="Shipments Created" value={data.summary.shipmentsCreated} />
            <MetricCard label="Delivered" value={data.summary.delivered} />
            <MetricCard label="Currently Delayed" value={data.summary.delayedNow} inverse />
            <MetricCard label="Shipping Cost" value={data.summary.shippingCostTotal} format="currency" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            <MetricCard label="Avg Delivery Time" value={`${data.summary.averageDeliveryTimeHours.toFixed(1)}h`} format="raw" />
            <MetricCard label="Median Delivery Time" value={`${data.summary.medianDeliveryTimeHours.toFixed(1)}h`} format="raw" />
            <MetricCard label="P90 Delivery Time" value={`${data.summary.p90DeliveryTimeHours.toFixed(1)}h`} format="raw" />
            <MetricCard label="P95 Delivery Time" value={`${data.summary.p95DeliveryTimeHours.toFixed(1)}h`} format="raw" />
          </div>
          {data.meta.percentileNote && <p className="text-xs text-gray-400">{data.meta.percentileNote}</p>}
        </>
      )}
    </div>
  );
}
