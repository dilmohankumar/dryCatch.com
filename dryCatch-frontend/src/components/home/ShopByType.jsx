// "What are you craving?" equivalent — a grid of catch types that jump into
// the shop with that category pre-filtered.
export default function ShopByType({ types = [], onSelect = () => {}, onExploreMore }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
      <h2 className="font-display text-2xl sm:text-4xl font-black text-[#3E2205] text-center mb-6 sm:mb-8">
        What are you craving?
      </h2>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
        {types.map((t, i) => (
          <button
            key={t.label}
            onClick={() => onSelect(t)}
            className={`group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
              i === 0 ? "ring-2 ring-gray-900" : ""
            }`}
            style={{ background: `radial-gradient(circle at 50% 35%, ${t.bg}EE, ${t.bg})` }}
          >
            {t.image ? (
              <img src={t.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-5xl sm:text-7xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                {t.emoji}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent pt-8 pb-2 sm:pb-2.5">
              <span className="text-[10px] sm:text-sm font-bold text-white block text-center">{t.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="text-center mt-6 sm:mt-8">
        <button
          onClick={onExploreMore}
          className="bg-gray-900 text-white font-bold px-6 py-2.5 rounded-full text-sm hover:bg-black transition-all active:scale-[0.97]"
        >
          Explore More Catch Types
        </button>
      </div>
    </section>
  );
}
