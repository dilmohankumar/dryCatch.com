import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import CohortTable from "../../../components/analytics/CohortTable.jsx";
import { friendlyError } from "./analyticsAdminUtils.js";

export default function AnalyticsCohorts() {
  const [monthsBack, setMonthsBack] = useState(6);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    adminAnalyticsAPI.cohorts({ monthsBack }).then((res) => setCohorts(res.cohorts)).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  }, [monthsBack]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cohort Retention</h1>
        <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <CohortTable cohorts={cohorts} />
        </div>
      )}
    </div>
  );
}
