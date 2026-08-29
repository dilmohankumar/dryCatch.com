import { useEffect, useMemo, useState } from "react";
import ProductGrid from "./productGrid";
import { productsAPI, categoriesAPI } from "../utils/api";
import { normalizeProducts, buildCategoryNameMap } from "../utils/productAdapters";
import { cacheProducts } from "../utils/productCache";

const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

// UI-facing sort labels never leak the backend's internal sort keys — see
// the spec's "don't expose internal database field names" guidance.
const SORT_TO_BACKEND = {
  "Alphabetical": "name_asc",
  "Price (Low to High)": "price_asc",
  "Price (High to Low)": "price_desc",
  "Discount (High to Low)": "discount_desc",
  "Popularity": "popularity",
};

// ─────────────────────────────────────────────────────────────────────────────
// Shop — the full catalog page: search, category pills, sort/filter (via the
// Sidebar rendered by StoreLayout) and the product grid. Filtering, sorting,
// and pagination are all server-side (GET /products with whitelisted query
// params) — this page no longer fetches the entire catalog to filter client-side.
// Reached from the landing page's "Shop Now" / category / "View All" actions.
// ─────────────────────────────────────────────────────────────────────────────
export default function Shop({
  selectedSort = null,
  selectedCats = [],
  selectedOrigins = [],
  cart = {},
  onProductClick = () => {},
  onInc,
  onDec,
  onFirstAdd,
  onOpenSidebar = () => {},
  onBackToHome = () => {},
  initialCategory = "All",
}) {
  // NOTE: the parent remounts this component (via a `key` prop keyed off the
  // category) whenever a category shortcut elsewhere in the app is clicked,
  // so `initialCategory` only needs to seed state once — no effect needed.
  const [activeCategory, setActiveCategory] = useState(initialCategory || "All");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Real categories, fetched once — replaces the old hardcoded pill/filter list.
  useEffect(() => {
    categoriesAPI.getAll().then(({ categories }) => setCategories(categories || [])).catch(() => setCategories([]));
  }, []);

  const categorySlugFilter = useMemo(() => {
    const slugs = [];
    if (activeCategory !== "All") slugs.push(activeCategory);
    for (const slug of selectedCats) if (!slugs.includes(slug)) slugs.push(slug);
    return slugs;
  }, [activeCategory, selectedCats]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => setPage(1), [activeCategory, selectedCats, selectedOrigins, selectedSort, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        page === 1 ? setLoading(true) : setLoadingMore(true);
        const categoriesRes = await categoriesAPI.getAll().catch(() => ({ categories: [] }));
        const categoryNameById = buildCategoryNameMap(categoriesRes.categories || []);

        const { data } = await productsAPI.getAll({
          category: categorySlugFilter,
          origin: selectedOrigins,
          sort: SORT_TO_BACKEND[selectedSort] || undefined,
          search: search.trim() || undefined,
          page,
          limit: 20,
        });
        if (cancelled) return;
        const normalized = normalizeProducts(data.items || [], categoryNameById);
        cacheProducts(normalized);
        setProducts((prev) => (page === 1 ? normalized : [...prev, ...normalized]));
        setPagination(data.pagination);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load products");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlugFilter, selectedOrigins, selectedSort, search, page]);

  const activeFilterCount = (selectedCats?.length || 0) + (selectedOrigins?.length || 0) + (selectedSort ? 1 : 0);
  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;

  return (
    <div className="flex-1 min-w-0 w-full">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        <button onClick={onBackToHome} className="hover:text-gray-700 transition-colors flex items-center gap-1">
          <BackIcon /> Home
        </button>
        <span>›</span>
        <button onClick={() => setActiveCategory("All")} className="hover:text-gray-700 transition-colors">
          Shop
        </button>
        {activeCategoryName && (
          <>
            <span>›</span>
            <span className="text-gray-700 font-medium">{activeCategoryName}</span>
          </>
        )}
      </nav>

      {/* Top bar */}
      <div className="flex flex-col gap-2 mb-3 sm:mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900">Shop Dry Catch</h1>
            <button className="hidden sm:flex items-center gap-1 text-[#1A3A5C] text-sm font-semibold hover:underline">
              Categories <ChevronDown />
            </button>
          </div>
          <button
            onClick={onOpenSidebar}
            className="md:hidden flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full hover:border-[#1A3A5C] transition-colors"
          >
            <FilterIcon /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#1A3A5C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Dry Catch, prawns, squid…"
            className="w-full pl-9 pr-8 py-2 rounded-full border border-gray-200 bg-gray-50 text-xs sm:text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/20 focus:border-[#1A3A5C] transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category pills — real categories from the Category collection */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("All")}
          className={`flex-shrink-0 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border text-[10px] sm:text-sm font-medium transition-all ${
            activeCategory === "All"
              ? "bg-[#EAF1FA] border-[#1A3A5C] text-[#1A3A5C]"
              : "bg-white border-gray-200 text-gray-600 hover:border-[#1A3A5C] hover:text-[#1A3A5C]"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setActiveCategory(cat.slug)}
            className={`flex-shrink-0 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border text-[10px] sm:text-sm font-medium transition-all ${
              activeCategory === cat.slug
                ? "bg-[#EAF1FA] border-[#1A3A5C] text-[#1A3A5C]"
                : "bg-white border-gray-200 text-gray-600 hover:border-[#1A3A5C] hover:text-[#1A3A5C]"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-gray-600">{pagination?.totalItems ?? products.length}</span> products
          {activeCategoryName && (
            <>
              {" "}
              · <span className="text-[#1A3A5C] font-semibold">{activeCategoryName}</span>
            </>
          )}
          {search && (
            <>
              {" "}
              · "<span className="text-[#1A3A5C] font-semibold">{search}</span>"
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {selectedSort && <span className="text-[9px] bg-[#EAF1FA] text-[#1A3A5C] border border-[#1A3A5C]/20 rounded-full px-2 py-0.5 font-medium">{selectedSort}</span>}
          {selectedCats?.map((slug) => (
            <span key={slug} className="text-[9px] bg-[#EAF1FA] text-[#1A3A5C] border border-[#1A3A5C]/20 rounded-full px-2 py-0.5 font-medium">
              {categories.find((c) => c.slug === slug)?.name || slug}
            </span>
          ))}
          {selectedOrigins?.map((o) => (
            <span key={o} className="text-[9px] bg-[#FFF4E6] text-[#E07B39] border border-[#E07B39]/20 rounded-full px-2 py-0.5 font-medium">
              {o}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Loading products…</div>
      ) : error ? (
        <div className="text-center py-16 text-sm text-red-500">
          Unable to load products. Please try again.
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium text-gray-600">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search</p>
          <button
            onClick={() => {
              setSearch("");
              setActiveCategory("All");
            }}
            className="mt-4 text-sm text-[#1A3A5C] font-semibold underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      ) : (
        <>
          <ProductGrid products={products} cart={cart} onInc={onInc} onDec={onDec} onFirstAdd={onFirstAdd} onProductClick={onProductClick} />
          {pagination?.hasNextPage && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="px-6 py-2 rounded-full border border-[#1A3A5C] text-[#1A3A5C] text-sm font-semibold hover:bg-[#EAF1FA] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
