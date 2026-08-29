// Slim strip of trust signals — mirrors the "Delivered Fast & Fresh · Vast
// Selection · Exceptional Quality · Premium Since 1929" bar on nuts.com.
export default function TrustBar({ points = [] }) {
  return (
    <section className="bg-[#3A1F1C]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-10 gap-y-3">
          {points.map((p, i) => (
            <div key={p.title} className="flex items-center gap-6 sm:gap-10">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg" role="img" aria-hidden="true">{p.icon}</span>
                <span className="text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider italic">{p.title}</span>
              </div>
              {i < points.length - 1 && <span className="hidden sm:inline text-white/30">◆</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
