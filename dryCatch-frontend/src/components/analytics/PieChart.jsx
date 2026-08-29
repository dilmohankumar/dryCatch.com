const COLORS = ["#1A3A5C", "#F4B740", "#5B8C5A", "#C1584C", "#7B6EA8", "#4A9BB5", "#D98E5A", "#8E8E8E"];

// Simple conic-gradient pie — CSS only, no SVG math needed for a static
// (non-interactive-slice) pie. A text legend always accompanies it (rule
// #134 — never color-only meaning).
export default function PieChart({ data = [], labelKey = "label", valueKey = "value", size = 160 }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  if (total === 0) return <div className="text-sm text-gray-400 text-center py-10">No data for this period</div>;

  let cumulative = 0;
  const stops = data.map((d, i) => {
    const start = (cumulative / total) * 360;
    cumulative += d[valueKey];
    const end = (cumulative / total) * 360;
    return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="rounded-full shrink-0" style={{ width: size, height: size, background: `conic-gradient(${stops.join(", ")})` }} aria-hidden="true" />
      <ul className="text-sm space-y-1.5">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} aria-hidden="true" />
            <span className="text-gray-700">{d[labelKey]}</span>
            <span className="text-gray-400">({total > 0 ? ((d[valueKey] / total) * 100).toFixed(1) : 0}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
