import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchAPI } from "../utils/api.js";
import { PLACEHOLDER_IMAGE } from "../utils/productAdapters.js";

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);
const StarIcon = ({ filled }) => (
  <svg className={`w-3 h-3 ${filled ? "text-amber-400" : "text-gray-200"}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SORT_OPTIONS = [
  { value: "relevance", label: "Best match" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Customer rating" },
  { value: "newest", label: "Newest" },
  { value: "best_selling", label: "Best selling" },
  { value: "featured", label: "Featured" },
];

const PAGE_SIZE = 20;

// Reads/writes the shareable, back-button-friendly URL as the single source
// of truth for query + filters + sort + page — no component-local filter
// state that could drift from what's in the address bar.
function useSearchQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(
    () => ({
      q: searchParams.get("q") || "",
      categoryId: searchParams.get("categoryId") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      rating: searchParams.get("rating") || "",
      availability: searchParams.get("availability") || "",
      sort: searchParams.get("sort") || "relevance",
      page: Number(searchParams.get("page")) || 1,
    }),
    [searchParams]
  );

  const update = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    setSearchParams(next);
  };

  return [state, update];
}

function FilterPanel({ facets, params, onChange }) {
  return (
    <div className="space-y-6">
      {facets?.categories?.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Category</h3>
          <div className="space-y-1.5">
            {facets.categories.map((f) => (
              <button
                key={f.value}
                onClick={() => onChange({ categoryId: params.categoryId === f.value ? "" : f.value })}
                className={`w-full flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                  params.categoryId === f.value ? "bg-[#EAF1FA] text-[#1A3A5C] font-semibold" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{f.value}</span>
                <span className="text-xs text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {facets?.price?.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Price</h3>
          <div className="space-y-1.5">
            {facets.price.map((f) => {
              const active = String(params.minPrice) === String(f.min) && String(params.maxPrice) === String(f.max ?? "");
              return (
                <button
                  key={f.label}
                  onClick={() =>
                    onChange(
                      active
                        ? { minPrice: "", maxPrice: "" }
                        : { minPrice: f.min ?? "", maxPrice: f.max ?? "" }
                    )
                  }
                  className={`w-full flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                    active ? "bg-[#EAF1FA] text-[#1A3A5C] font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-xs text-gray-400">{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {facets?.ratings?.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Rating</h3>
          <div className="space-y-1.5">
            {facets.ratings.map((f) => (
              <button
                key={f.value}
                onClick={() => onChange({ rating: String(params.rating) === String(f.value) ? "" : f.value })}
                className={`w-full flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                  String(params.rating) === String(f.value) ? "bg-[#EAF1FA] text-[#1A3A5C] font-semibold" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < f.value} />)}
                  <span className="ml-1">& up</span>
                </span>
                <span className="text-xs text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Availability</h3>
        <div className="space-y-1.5">
          {["in_stock", "out_of_stock"].map((v) => (
            <button
              key={v}
              onClick={() => onChange({ availability: params.availability === v ? "" : v })}
              className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                params.availability === v ? "bg-[#EAF1FA] text-[#1A3A5C] font-semibold" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {v === "in_stock" ? "In stock" : "Out of stock"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchProductCard({ product, position, query, onClick }) {
  const handleClick = () => {
    // Fire-and-forget click-tracking — never awaited/blocked on navigation.
    searchAPI
      .trackClick({ query, productId: product.productId, position })
      .catch(() => {});
    onClick(product);
  };

  const outOfStock = product.inventoryStatus === "out_of_stock" || product.inventoryStatus === "OUT_OF_STOCK";

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
    >
      <div className="relative overflow-hidden flex-shrink-0 bg-gray-100" style={{ height: 180 }}>
        <img src={PLACEHOLDER_IMAGE} alt={product.name} className="w-full h-full object-cover" />
        {product.featured && (
          <span className="absolute top-2 left-2 bg-[#E07B39] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
            Featured
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] font-semibold text-center py-1">
            Out of stock
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col gap-1 flex-1">
        <p className="text-[9px] sm:text-[10px] font-medium text-gray-400 truncate">{product.category}</p>
        <h3 className="font-bold text-gray-900 text-[11px] sm:text-xs leading-snug line-clamp-2">{product.name}</h3>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < Math.round(product.rating || 0)} />)}
          <span className="text-[9px] text-gray-400 ml-1">({product.reviewCount || 0})</span>
        </div>
        <div className="mt-0.5">
          {product.minPrice != null && product.maxPrice != null && product.minPrice !== product.maxPrice ? (
            <span className="text-sm sm:text-base font-extrabold text-gray-900">
              ₹{product.minPrice} - ₹{product.maxPrice}
            </span>
          ) : (
            <span className="text-sm sm:text-base font-extrabold text-gray-900">₹{product.price ?? product.minPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// /search?q=&categoryId=&minPrice=&maxPrice=&rating=&availability=&sort=&page=
// Dedicated search-index-backed results page — distinct from /shop's plain
// category browsing. Filters/sort/page all live in the URL (shareable,
// back-button-friendly). Handles the zero-result state (didYouMean,
// popularProducts, suggestedSearches) and a merchandising `redirect`.
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchResults() {
  const [params, updateParams] = useSearchQueryParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    searchAPI
      .search(
        {
          q: params.q,
          categoryId: params.categoryId,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          rating: params.rating,
          availability: params.availability,
          sort: params.sort,
          page: params.page,
          limit: PAGE_SIZE,
        },
        { signal: controller.signal }
      )
      .then((data) => {
        if (cancelled) return;
        if (data.redirect) {
          navigate(data.redirect, { replace: true });
          return;
        }
        setResult(data);
      })
      .catch((err) => {
        if (cancelled || err.name === "AbortError") return;
        setError(err.message || "Search failed. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.categoryId, params.minPrice, params.maxPrice, params.rating, params.availability, params.sort, params.page]);

  const goProduct = (product) => navigate(`/product/${product.slug || product.productId}`);

  const activeFilterCount =
    (params.categoryId ? 1 : 0) + (params.minPrice || params.maxPrice ? 1 : 0) + (params.rating ? 1 : 0) + (params.availability ? 1 : 0);

  const clearAllFilters = () =>
    updateParams({ categoryId: "", minPrice: "", maxPrice: "", rating: "", availability: "" });

  return (
    <div className="flex-1 min-w-0 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900">
            {params.q ? (
              <>
                Results for "<span className="text-[#1A3A5C]">{params.q}</span>"
              </>
            ) : (
              "Search"
            )}
          </h1>
          {!loading && result && !result.redirect && (
            <p className="text-xs text-gray-400 mt-1">
              <span className="font-semibold text-gray-600">{result.total ?? 0}</span> products found
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="lg:hidden flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full hover:border-[#1A3A5C] transition-colors"
          >
            <FilterIcon /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#1A3A5C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <select
            value={params.sort}
            onChange={(e) => updateParams({ sort: e.target.value }, { resetPage: false })}
            className="text-xs sm:text-sm border border-gray-200 rounded-full px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#1A3A5C]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        {!loading && result && !result.redirect && result.total > 0 && (
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <FilterPanel facets={result.facets} params={params} onChange={(patch) => updateParams(patch)} />
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-sm text-gray-400">Searching…</div>
          ) : error ? (
            <div className="text-center py-16 text-sm text-red-500">{error}</div>
          ) : !result || result.redirect ? null : result.total === 0 ? (
            <ZeroResults result={result} params={params} onRunSearch={(q) => updateParams({ q })} onProductClick={goProduct} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-5">
                {result.products.map((p, i) => (
                  <SearchProductCard
                    key={p.productId}
                    product={p}
                    position={(params.page - 1) * PAGE_SIZE + i + 1}
                    query={params.q}
                    onClick={goProduct}
                  />
                ))}
              </div>

              {result.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    disabled={params.page <= 1}
                    onClick={() => updateParams({ page: params.page - 1 }, { resetPage: false })}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40 hover:border-[#1A3A5C]"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-gray-400">
                    Page {result.page} of {result.totalPages}
                  </span>
                  <button
                    disabled={params.page >= result.totalPages}
                    onClick={() => updateParams({ page: params.page + 1 }, { resetPage: false })}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 disabled:opacity-40 hover:border-[#1A3A5C]"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile filter drawer/bottom sheet — never forces the desktop sidebar layout */}
      {filterDrawerOpen && result && !result.redirect && (
        <div className="fixed inset-0 z-[150] flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterDrawerOpen(false)} />
          <div className="relative bg-white w-full max-h-[80vh] rounded-t-3xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">Filters</h2>
              <button onClick={() => setFilterDrawerOpen(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FilterPanel facets={result.facets} params={params} onChange={(patch) => updateParams(patch)} />
            </div>
            <div className="border-t border-gray-100 px-5 py-3 flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  clearAllFilters();
                }}
                className="flex-1 text-sm font-semibold text-gray-600 py-2.5 rounded-full border border-gray-200"
              >
                Clear all
              </button>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="flex-1 text-sm font-bold text-white py-2.5 rounded-full bg-[#1A3A5C]"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Never a blank page: didYouMean (clickable, re-runs the corrected term),
// popular products fallback, and suggested-search chips.
function ZeroResults({ result, params, onRunSearch, onProductClick }) {
  return (
    <div className="py-10 text-center">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-sm font-semibold text-gray-700">
        No results for "{params.q}"
      </p>

      {result.didYouMean && (
        <p className="text-sm text-gray-500 mt-2">
          Did you mean{" "}
          <button
            onClick={() => onRunSearch(result.didYouMean)}
            className="text-[#1A3A5C] font-semibold underline underline-offset-2"
          >
            {result.didYouMean}
          </button>
          ?
        </p>
      )}

      {result.suggestedSearches?.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {result.suggestedSearches.map((s) => (
            <button
              key={s}
              onClick={() => onRunSearch(s)}
              className="text-xs bg-gray-100 hover:bg-[#EAF1FA] hover:text-[#1A3A5C] text-gray-600 font-medium px-3 py-1.5 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {result.popularProducts?.length > 0 && (
        <div className="mt-8 text-left">
          <h3 className="text-sm font-bold text-gray-800 mb-3 text-center">Popular products</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-5">
            {result.popularProducts.map((p, i) => (
              <SearchProductCard key={p.productId} product={p} position={i + 1} query={params.q} onClick={onProductClick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
