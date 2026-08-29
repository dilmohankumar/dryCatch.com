// Cohort retention matrix (rule #92) — rows are acquisition cohorts,
// columns are months-since-acquisition. Color intensity is a secondary
// cue only; the percentage text is always the primary, color-independent
// signal (rule #134).
function cellColor(rate) {
  if (rate >= 0.5) return "bg-green-600 text-white";
  if (rate >= 0.25) return "bg-green-300 text-gray-900";
  if (rate >= 0.1) return "bg-green-100 text-gray-900";
  if (rate > 0) return "bg-gray-100 text-gray-700";
  return "bg-gray-50 text-gray-400";
}

export default function CohortTable({ cohorts = [] }) {
  if (cohorts.length === 0) return <div className="text-sm text-gray-400 text-center py-10">Not enough order history yet to build a cohort matrix</div>;
  const maxMonths = Math.max(...cohorts.map((c) => c.retention.length));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-gray-500 sticky left-0 bg-white">Cohort</th>
            <th className="p-2 text-right font-medium text-gray-500">Size</th>
            {Array.from({ length: maxMonths }, (_, i) => (
              <th key={i} className="p-2 text-center font-medium text-gray-500">M{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortMonth}>
              <td className="p-2 font-medium text-gray-800 sticky left-0 bg-white">{cohort.cohortMonth}</td>
              <td className="p-2 text-right text-gray-500">{cohort.cohortSize}</td>
              {cohort.retention.map((r) => (
                <td key={r.monthOffset} className={`p-2 text-center rounded ${cellColor(r.retentionRate)}`}>
                  {(r.retentionRate * 100).toFixed(0)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
