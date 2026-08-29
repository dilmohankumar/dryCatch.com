// Dependency-free SVG line chart (no charting library installed in this
// project, and one data series over a date range doesn't warrant adding
// one). `series` = [{ x: "2026-08-01", y: 1234 }, ...]. Accessible: every
// point gets a <title> tooltip, and the raw values are always available
// via the data table view alongside it (rule #134 — never chart-only).
export default function LineChart({ series = [], height = 200, color = "#1A3A5C", valueFormatter = (v) => v }) {
  if (series.length === 0) return <div className="text-sm text-gray-400 text-center py-10">No data for this period</div>;

  const width = 100; // percentage-based viewBox, scales via CSS width
  const values = series.map((p) => p.y);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = series.map((p, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * width;
    const y = height - ((p.y - min) / range) * height;
    return { x, y, ...p };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y.toFixed(2)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <path d={path} fill="none" stroke={color} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="0.8" fill={color}>
            <title>{`${p.x0 || p.x}: ${valueFormatter(p.y)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{series[0]?.x}</span>
        <span>{series.at(-1)?.x}</span>
      </div>
    </div>
  );
}
