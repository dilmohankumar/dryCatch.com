import { useEffect, useState } from "react";
import { growthAPI } from "../../utils/api.js";

// Phase 24 — "related products" and "frequently bought together" rails.
// Both endpoints already return {items: []}, degrade to an empty array on
// any fetch failure (rule #71 — recommendations must never break the page
// they render on), and are skipped entirely once loaded-but-empty rather
// than rendering a hollow section.
function ProductRail({ title, items, onSelect }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="pb-6 sm:pb-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {items.map((p) => (
          <button
            key={p._id || p.id}
            onClick={() => onSelect?.(p)}
            className="flex-shrink-0 w-36 sm:w-44 text-left border border-gray-100 rounded-xl sm:rounded-2xl p-3 hover:shadow-md transition-shadow bg-white"
          >
            <div className="w-full aspect-square bg-gray-50 rounded-lg mb-2 flex items-center justify-center text-2xl overflow-hidden">
              {p.media?.[0]?.url ? <img src={p.media[0].url} alt={p.name} className="w-full h-full object-cover" /> : "🐟"}
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
            <p className="text-sm font-bold text-[#1A3A5C]">₹{p.price}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function ProductRecommendations({ productId, onSelectProduct }) {
  const [related, setRelated] = useState([]);
  const [fbt, setFbt] = useState([]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    growthAPI.getRelated(productId).then((r) => !cancelled && setRelated(r.items || [])).catch(() => {});
    growthAPI.getFrequentlyBoughtTogether(productId).then((r) => !cancelled && setFbt(r.items || [])).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <>
      <ProductRail title="Frequently Bought Together" items={fbt} onSelect={onSelectProduct} />
      <ProductRail title="You May Also Like" items={related} onSelect={onSelectProduct} />
    </>
  );
}
