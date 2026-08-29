import { useRef } from "react";

const StarIcon = ({ filled }) => (
  <svg className={`w-3 h-3 ${filled ? "text-amber-400" : "text-gray-200"}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);
const MinusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
  </svg>
);

const discountPct = (p, m) => (m > p ? Math.round(((m - p) / m) * 100) : 0);

const RecycleIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
// Gold hanging award-ribbon banner with a star — matches the "best seller"
// ribbon nuts.com pins to the top-left corner of its product cards.
const RibbonIcon = () => (
  <svg className="w-7 h-10 sm:w-8 sm:h-12" viewBox="0 0 28 40" fill="none">
    <path d="M0 0h28v34l-14-7-14 7V0z" fill="#F4B740" />
    <path
      d="M14 8l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6L14 8z"
      fill="#fff"
    />
  </svg>
);

function CarouselCard({ product, qty, onInc, onDec, onFirstAdd, onCardClick }) {
  const variant = product.variants?.[0] || { price: product.price, mrp: product.mrp, label: product.weight };
  const discount = discountPct(variant.price, variant.mrp);

  return (
    <div
      className="w-[160px] sm:w-[200px] flex-shrink-0 bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer snap-start border border-gray-100"
      onClick={() => onCardClick(product)}
    >
      <div className="relative w-full h-[120px] sm:h-[160px] flex-shrink-0" style={{ background: product.bg || "#f5f5f5" }}>
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        {product.bestseller && (
          <span className="absolute top-0 left-2 drop-shadow">
            <RibbonIcon />
          </span>
        )}
        {qty > 0 && (
          <span className="absolute top-2 right-2 bg-[#1A3A5C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            {qty} in cart
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 flex-1">
        <h3 className="font-bold text-gray-900 text-[11px] sm:text-xs leading-snug line-clamp-2 min-h-[28px] sm:min-h-[32px]">
          {product.name}
        </h3>

        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < (product.rating || 0)} />)}
          <span className="text-[9px] text-gray-400 ml-1">({product.reviews || 0})</span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm sm:text-base font-extrabold text-gray-900">₹{variant.price}</span>
          {variant.mrp > variant.price && (
            <span className="text-[9px] sm:text-[10px] text-gray-400 line-through">₹{variant.mrp}</span>
          )}
        </div>

        {discount > 0 && (
          <span className="text-[9px] font-bold text-[#7A5300] bg-[#FCE7B0] rounded-md px-1.5 py-0.5 self-start">
            Buy One, Get 2nd {discount}% Off
          </span>
        )}

        <p className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1">
          <RecycleIcon /> Save 5% with Auto-delivery
        </p>
        <p className="text-[9px] sm:text-[10px] text-gray-400">{variant.label} bag</p>

        <div className="mt-auto pt-1.5" onClick={(e) => e.stopPropagation()}>
          {qty > 0 ? (
            <div className="flex items-center justify-between gap-1 bg-[#2C5F4A] rounded-full px-2 py-1.5">
              <button onClick={onDec} className="text-white/90 hover:text-white transition-colors">
                <MinusIcon />
              </button>
              <span className="text-white text-xs font-bold tabular-nums">{qty}</span>
              <button onClick={onInc} className="text-white/90 hover:text-white transition-colors">
                <PlusIcon />
              </button>
            </div>
          ) : (
            <button
              onClick={onFirstAdd}
              className="w-full text-[10px] sm:text-xs font-bold py-2 rounded-full bg-[#2C5F4A] text-white hover:bg-[#234c3b] transition-all active:scale-95"
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Horizontally-scrollable product row, used for "Best Sellers", "Combo Packs", etc.
// Props: title, subtitle, products, cart ({id: qty}), onInc/onDec/onFirstAdd(id),
// onProductClick(product), viewAllLabel, onViewAll.
export default function ProductCarousel({
  title,
  subtitle,
  products = [],
  cart = {},
  onInc = () => {},
  onDec = () => {},
  onFirstAdd = () => {},
  onProductClick = () => {},
  viewAllLabel = "View All",
  onViewAll,
  onOrange = false, // renders on the amber hero block (nuts.com style)
}) {
  const scrollerRef = useRef(null);

  const scrollBy = (dir) => {
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const headingColor = onOrange ? "text-[#2D1A05]" : "text-gray-900";
  const mutedColor = onOrange ? "text-[#5C3212]/80" : "text-gray-500";
  const arrowClasses = onOrange
    ? "border-[#5C3212]/30 text-[#5C3212] hover:border-[#2D1A05] hover:text-[#2D1A05]"
    : "border-gray-200 text-gray-500 hover:border-[#1A3A5C] hover:text-[#1A3A5C]";

  return (
    <section className={`max-w-7xl mx-auto px-4 sm:px-6 ${onOrange ? "pt-4 pb-10 sm:pb-14" : "py-8 sm:py-12"}`}>
      <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h2 className={`font-display text-lg sm:text-2xl font-black ${headingColor}`}>{title}</h2>
          {subtitle && <p className={`text-xs sm:text-sm mt-1 ${mutedColor}`}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <span className={`hidden sm:inline text-sm ${mutedColor}`}>{products.length} items</span>
          {onViewAll && (
            <button onClick={onViewAll} className={`text-xs sm:text-sm font-semibold hover:underline underline-offset-2 ${onOrange ? "text-[#2D1A05]" : "text-[#1A3A5C]"}`}>
              {viewAllLabel}
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={() => scrollBy(-1)} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${arrowClasses}`}>
              <ChevronLeftIcon />
            </button>
            <button onClick={() => scrollBy(1)} className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${arrowClasses}`}>
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollerRef} className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-hide">
        {products.map((p) => {
          // Cart lines reference a variant, not a product (Phase 6).
          const cartKey = p.defaultVariantId || p.id;
          return (
            <CarouselCard
              key={p.id}
              product={p}
              qty={cart[cartKey] || 0}
              onInc={() => onInc(cartKey)}
              onDec={() => onDec(cartKey)}
              onFirstAdd={() => onFirstAdd(cartKey)}
              onCardClick={onProductClick}
            />
          );
        })}
      </div>
    </section>
  );
}
