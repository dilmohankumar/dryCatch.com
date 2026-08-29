// ONE shared date-range control (rule #97) — every analytics page uses
// this instead of reinventing its own date logic. Presets map 1:1 to the
// backend's utils/dateRange.js periods.
const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
  { value: "last90days", label: "Last 90 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export default function DateRangePicker({ value, onChange }) {
  const { period = "last30days", startDate = "", endDate = "" } = value || {};

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={period}
        onChange={(e) => onChange({ ...value, period: e.target.value })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        aria-label="Date range preset"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {period === "custom" && (
        <>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            aria-label="Start date"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            aria-label="End date"
          />
        </>
      )}
    </div>
  );
}
