// Social-proof stat strip — used instead of a fake "As Seen On" press row
// so we don't imply endorsements that don't exist yet on a demo build.
export default function StatsBar({ stats = [] }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xl sm:text-3xl font-extrabold text-[#1A3A5C]">{s.value}</p>
            <p className="text-[11px] sm:text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
