import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import FunnelChart from "../../../components/analytics/FunnelChart.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsFunnel() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminAnalyticsAPI.funnel(range).then((res) => setStages(res.stages)).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversion Funnel</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <FunnelChart stages={stages} />
          <p className="text-xs text-gray-400 mt-6">
            Segmentation by device/traffic-source/campaign is not available yet — see docs/analytics.md for scope notes.
          </p>
        </div>
      )}
    </div>
  );
}
