import dryPrawns from "../../assets/Dry-Prawns.jpg";
import bombayDuck from "../../assets/bombay-duck.jpg";

// nuts.com-style asymmetric promo grid:
// tall left tile + two stacked right tiles, sharp corners, tight gutters.
export default function PromoGrid({ onShopNow }) {
  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-5 pb-1 sm:pb-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5 md:h-[460px] lg:h-[520px]">
        {/* Left — large feature */}
        <button
          type="button"
          onClick={onShopNow}
          className="relative overflow-hidden text-left group min-h-[260px] md:min-h-0 bg-[#9B9CE8]"
        >
          <img
            src={dryPrawns}
            alt=""
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#7B7CD4]/90 via-[#9B9CE8]/55 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center h-full p-6 sm:p-10 max-w-[300px]">
            <h2 className="font-display text-3xl sm:text-5xl font-black text-[#1A1530] leading-[1.05]">
              Fresh from the Coast
            </h2>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-[#1A1530]/85 leading-snug">
              Sun-dried prawns, fish &amp; more — stock the pantry the coastal way.
            </p>
            <span className="mt-5 sm:mt-6 inline-flex self-start bg-white text-gray-900 font-bold px-6 py-2.5 rounded-full text-sm group-hover:bg-gray-50 transition-colors">
              Shop Now
            </span>
          </div>
        </button>

        {/* Right — stacked */}
        <div className="grid grid-rows-2 gap-2 sm:gap-2.5 min-h-[340px] md:min-h-0">
          <button
            type="button"
            onClick={onShopNow}
            className="relative overflow-hidden text-left group bg-[#E8B84A]"
          >
            <img
              src={bombayDuck}
              alt=""
              className="absolute right-0 top-0 h-full w-[55%] object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#E8B84A] via-[#E8B84A]/90 to-transparent w-[55%]" />
            <div className="relative z-10 flex flex-col justify-center h-full p-5 sm:p-7 max-w-[230px]">
              <h2 className="font-display text-2xl sm:text-[1.75rem] font-black text-[#3E2205] leading-tight">
                Coastal Flavors
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#3E2205]/80">
                Seasonal picks &amp; festive gift packs.
              </p>
              <span className="mt-3 text-sm font-bold text-[#3E2205] underline underline-offset-4">
                Shop Now
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onShopNow}
            className="relative overflow-hidden text-left group bg-[#2D5A43]"
          >
            <img
              src={dryPrawns}
              alt=""
              className="absolute right-0 top-0 h-full w-[55%] object-cover opacity-85 group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2D5A43] via-[#2D5A43]/92 to-transparent w-[55%]" />
            <div className="relative z-10 flex flex-col justify-center h-full p-5 sm:p-7 max-w-[230px]">
              <h2 className="font-display text-2xl sm:text-[1.75rem] font-black text-white leading-tight">
                Greatest Hits
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-white/85">The best of the best.</p>
              <span className="mt-3 text-sm font-bold text-white underline underline-offset-4">
                Shop Now
              </span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
