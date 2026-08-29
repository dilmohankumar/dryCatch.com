// Reusable KPI card (rule #99). Positive/negative change is never
// color-only (rule #134) — an explicit ▲/▼ glyph carries the meaning too.
export default function MetricCard({ label, value, changePercent, format = "number", inverse = false }) {
  const formatted = formatValue(value, format);
  const hasChange = changePercent !== undefined && changePercent !== null && Number.isFinite(changePercent);
  const isPositive = hasChange && changePercent >= 0;
  const isGood = inverse ? !isPositive : isPositive;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{formatted}</p>
      {hasChange && (
        <p className={`text-xs font-medium mt-1 ${isGood ? "text-green-600" : "text-red-600"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(changePercent * 100).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
}

function formatValue(value, format) {
  if (format === "raw") return value; // caller already formatted the string (e.g. "12.3h")
  const n = Number(value) || 0;
  if (format === "currency") return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  if (format === "percent") return `${(n * 100).toFixed(1)}%`;
  return n.toLocaleString("en-IN");
}
