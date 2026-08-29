// Visual funnel (rule #91) — count + percentage + drop-off per stage,
// width proportional to conversion-from-start so the shape is meaningful,
// not just decorative.
export default function FunnelChart({ stages = [] }) {
  if (stages.length === 0) return <div className="text-sm text-gray-400 text-center py-10">No funnel data for this period</div>;
  const maxCount = stages[0]?.count || 1;

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div className="w-36 text-xs text-gray-600 text-right shrink-0">{stage.label}</div>
            <div className="flex-1 bg-gray-100 rounded h-8 relative overflow-hidden">
              <div className="h-full bg-[#1A3A5C] rounded flex items-center px-2" style={{ width: `${Math.max(widthPct, 2)}%` }}>
                <span className="text-white text-xs font-semibold whitespace-nowrap">{stage.count.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="w-32 text-xs text-gray-500 shrink-0">
              {(stage.conversionFromStart * 100).toFixed(1)}% of total
              {stage.dropOffFromPrevious > 0 && <span className="text-red-500 block">-{(stage.dropOffFromPrevious * 100).toFixed(1)}% drop-off</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
