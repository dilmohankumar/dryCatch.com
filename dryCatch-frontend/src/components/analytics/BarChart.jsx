// Dependency-free bar chart — simple flex/div bars, not SVG, since heights
// as percentages are simpler to reason about and remain crisp at any size.
export default function BarChart({ data = [], labelKey = "label", valueKey = "value", height = 200, color = "#1A3A5C", valueFormatter = (v) => v }) {
  if (data.length === 0) return <div className="text-sm text-gray-400 text-center py-10">No data for this period</div>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d[valueKey] / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-gray-900 text-white rounded px-1.5 py-0.5 whitespace-nowrap">
              {valueFormatter(d[valueKey])}
            </div>
            <div className="w-full rounded-t" style={{ height: `${pct}%`, minHeight: d[valueKey] > 0 ? 2 : 0, backgroundColor: color }} />
            <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center" title={d[labelKey]}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}
