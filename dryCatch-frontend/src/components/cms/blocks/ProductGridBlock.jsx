import { useNavigate } from "react-router-dom";
import { normalizeProducts } from "../../../utils/productAdapters.js";

// productGrid.data.products is already pre-resolved by the backend (live
// Product docs — name/slug/price/mrp/media/rating/reviewsCount), so this
// block doesn't fetch anything itself. Reuses the same normalizeProducts
// adapter the rest of the storefront uses, for a consistent image/price
// fallback shape, but renders a lightweight card rather than pulling in the
// full cart-aware ProductGrid/ProductCard (which needs cart wiring this
// CMS-driven context doesn't have).
export default function ProductGridBlock({ data = {} }) {
  const navigate = useNavigate();
  const rawProducts = Array.isArray(data.products) ? data.products : [];
  if (rawProducts.length === 0) return null;
  const products = normalizeProducts(rawProducts);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{data.heading}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col"
            onClick={() => navigate(`/product/${p.id}`)}
          >
            <div className="h-40 sm:h-48 overflow-hidden bg-gray-100">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 flex flex-col gap-1">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2">{p.name}</h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-extrabold text-gray-900">₹{p.variants[0]?.price ?? p.price}</span>
                {p.variants[0]?.mrp > p.variants[0]?.price && (
                  <span className="text-[10px] text-gray-400 line-through">₹{p.variants[0].mrp}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
