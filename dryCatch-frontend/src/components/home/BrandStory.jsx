import ScallopDivider from "./ScallopDivider";

// Bottom brand-story banner — mirrors the "From Poppy Sol's market stand 95
// years ago…" strip on nuts.com, right before the footer.
const NAVY = "#132A44";

export default function BrandStory({ onShopNow }) {
  return (
    <>
      <ScallopDivider baseColor={NAVY} bumpColor="#ffffff" bumpsAt="top" />
      <section className="bg-[#132A44]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center flex flex-col items-center gap-4 sm:gap-5">
          <p className="font-display text-[#7EC8C0] text-base sm:text-2xl font-semibold leading-relaxed">
            From a single fishing boat on the Kerala coast to thousands of
            coastal homes across India — we've grown to offer sun-dried
            prawns, fish, combo packs and more, all crafted with care.
          </p>
          <button
            onClick={onShopNow}
            className="bg-[#2C8C82] text-white font-bold px-6 sm:px-7 py-3 rounded-full text-sm sm:text-base hover:bg-[#25746c] transition-all active:scale-[0.97] shadow-md"
          >
            Shop Best Sellers
          </button>
        </div>
      </section>
    </>
  );
}
