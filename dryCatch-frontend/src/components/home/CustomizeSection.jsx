import bombayDuck from "../../assets/bombay-duck.jpg";

// "Make It Your Own" equivalent — invites the customer to build a custom
// hamper / gift box from a selection of Dry Catch products.
export default function CustomizeSection({ onCustomize }) {
  const swatches = [
    { emoji: "🦐", label: "Prawns", bg: "#FFF4E6" },
    { emoji: "🐟", label: "Bombay Duck", bg: "#E8F4FD" },
    { emoji: "🦑", label: "Squid", bg: "#FFFBEA" },
    { emoji: "🐡", label: "Sardines", bg: "#FFF0F3" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-14 items-center">
        {/* Photo in a thick brown frame with product swatches overlapping the
            bottom edge — mirrors the nuts.com "build a box" visual. */}
        <div className="relative w-full max-w-[440px] mx-auto pb-8 sm:pb-10">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden border-[8px] sm:border-[12px] border-[#5C3212] shadow-lg">
            <img
              src={bombayDuck}
              alt="Assorted Dry Catch hamper"
              className="w-full h-56 sm:h-72 object-cover"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 sm:gap-3">
            {swatches.map((s) => (
              <div
                key={s.label}
                className="w-16 sm:w-20 rounded-lg sm:rounded-xl flex flex-col items-center justify-center gap-0.5 py-1.5 sm:py-2 shadow-md ring-2 ring-white"
                style={{ background: s.bg }}
              >
                <span className="text-lg sm:text-xl">{s.emoji}</span>
                <span className="text-[8px] sm:text-[9px] font-bold text-gray-700 uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4 text-center md:text-left items-center md:items-start">
          <h2 className="font-display text-2xl sm:text-4xl font-black text-[#3E2205]">Make It Your Own</h2>
          <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-md">
            Customize your perfect gift box, party tray, or care package from a
            vast selection of coastal goodies. Dry Prawns, Bombay Duck,
            Squid & Sardines — it's all fair game.
          </p>
          <button
            onClick={onCustomize}
            className="mt-1 bg-gray-900 text-white font-bold px-6 py-3 rounded-full text-sm hover:bg-black transition-all active:scale-[0.97] shadow-sm"
          >
            Shop Custom
          </button>
        </div>
      </div>
    </section>
  );
}
