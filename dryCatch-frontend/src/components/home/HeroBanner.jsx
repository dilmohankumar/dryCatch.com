import dryPrawns from "../../assets/Dry-Prawns.jpg";

// "Don't Overthink It / Try our Greatest Hits" panel — sits inside the amber
// colour block (shared with the bestsellers carousel), after the promo grid
// and category circles — matching the current nuts.com page flow.
export default function HeroBanner({ onShopNow }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-10 grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-6 sm:gap-12 items-center">
      <div className="flex flex-col gap-3 sm:gap-5 order-2 md:order-1 text-center md:text-left items-center md:items-start">
        <p className="text-[11px] sm:text-sm font-bold tracking-[0.2em] text-[#5C3212] uppercase">Don't Overthink It.</p>
        <h1 className="font-display text-4xl sm:text-6xl font-black text-[#2D1A05] leading-[1.02]">
          Try our Greatest Hits
        </h1>
        <p className="text-sm sm:text-lg text-[#5C3212]/90 max-w-md leading-relaxed">
          Taste the very best of India's coastal fishing communities — sun-dried,
          naturally preserved Dry Catch our customers never order just once.
        </p>
        <button
          onClick={onShopNow}
          className="mt-2 bg-white text-gray-900 font-bold px-8 sm:px-10 py-3 sm:py-4 rounded-full text-sm sm:text-base hover:bg-gray-50 transition-all active:scale-[0.97] shadow-md"
        >
          Shop Now
        </button>
      </div>

      <div className="order-1 md:order-2 rounded-2xl sm:rounded-[2rem] overflow-hidden h-48 sm:h-[400px] shadow-xl">
        <img
          src={dryPrawns}
          alt="Sun-dried prawns, fresh from the coast"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
