// "As Seen On" equivalent — a lightweight press-mention strip. Uses generic
// placeholder publication names (not real outlets) since this is demo data;
// swap for real logos/quotes once press coverage exists.
export default function FeaturedIn({ mentions = [] }) {
  return (
    <section className="bg-[#FFF8F0] border-t border-[#3E2205]/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-center text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#5C3212]/60 uppercase mb-6">
          As seen on
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10 text-center">
          {mentions.map((m) => (
            <div key={m.outlet} className="flex flex-col items-center gap-2">
              <span className="text-lg sm:text-xl font-black text-gray-800 tracking-tight">{m.outlet}</span>
              <p className="text-xs sm:text-sm text-gray-500 italic max-w-xs">"{m.quote}"</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
