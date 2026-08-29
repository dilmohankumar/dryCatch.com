import { useEffect, useState } from "react";
import { getMegaMenu } from "../data/megaMenu";
import { productsAPI, categoriesAPI } from "../utils/api";
import { normalizeProducts, buildCategoryNameMap } from "../utils/productAdapters";
import { cacheProducts } from "../utils/productCache";
import { useSEO } from "../hooks/useSEO.js";

// Category landing page — hero, sub-links from mega menu, promo cards, and a
// filtered product grid backed by the real product catalog API.
export default function CategoryPage({
  slug,
  filter = "All",
  tag = null,
  highlightLabel = null,
  cart = {},
  onInc = () => {},
  onDec = () => {},
  onFirstAdd = () => {},
  onProductClick = () => {},
  onBackToHome = () => {},
  onNavigateCategory = () => {},
}) {
  const menu = getMegaMenu(slug);
  const title = highlightLabel || menu?.label || "Shop";
  const description = menu?.description || "Browse our coastal Dry Catch collection.";

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Phase 23 — category-page metadata. `tag`-filtered views of the same
  // slug are non-canonical variants of the base category page (rule #29-31
  // — one curated slug is the indexable page; a tag/filter narrowing of it
  // isn't a separate page worth competing in search results).
  useSEO({
    title: `${title} | DryCatch`,
    description,
    canonical: slug ? `/category/${slug}` : undefined,
    robots: tag ? "noindex,follow" : "index,follow",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [categoriesRes, productsRes] = await Promise.all([
          categoriesAPI.getAll().catch(() => ({ categories: [] })),
          // This page still filters by the megaMenu's curated `filter` tag
          // client-side (see the deliberate megaMenu-vs-Category note in
          // Phase 3's audit) rather than the real ?category= slug filter, so
          // it needs the (near-)full catalog rather than one server page.
          productsAPI.getAll({ limit: 100 }),
        ]);
        if (cancelled) return;
        const categoryNameById = buildCategoryNameMap(categoriesRes.categories || []);
        const normalized = normalizeProducts(productsRes.data?.items || [], categoryNameById);
        cacheProducts(normalized);
        setAllProducts(normalized);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let products = allProducts;
  if (filter && filter !== "All") {
    products = products.filter((p) => p.category === filter);
  }
  if (tag === "bestseller") {
    products = products.filter((p) => p.bestseller);
  }

  // If a tight filter emptied the grid, fall back to the category's products
  // so the page never looks broken.
  if (products.length === 0 && menu) {
    products = allProducts.filter((p) =>
      menu.filter === "All" ? true : p.category === menu.filter
    );
  }

  const subLinks = menu?.columns?.flatMap((c) => c.links) || [];

  return (
    <div className="flex-1 min-w-0 w-full bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-[#FAFAF8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 text-xs sm:text-sm text-gray-500">
          <button type="button" onClick={onBackToHome} className="hover:text-gray-900 hover:underline">
            Home
          </button>
          <span className="mx-2">/</span>
          {menu && highlightLabel && highlightLabel !== menu.label ? (
            <>
              <button
                type="button"
                onClick={() => onNavigateCategory({ slug: menu.slug, filter: menu.filter })}
                className="hover:text-gray-900 hover:underline"
              >
                {menu.label}
              </button>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">{highlightLabel}</span>
            </>
          ) : (
            <span className="text-gray-900 font-medium">{title}</span>
          )}
        </div>
      </div>

      {/* Category hero */}
      <section className="bg-[#FFF8F0] border-b border-[#EFE4D4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-[#5C3212]/70 uppercase mb-2">
            Dry Catch Collection
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-black text-[#2D1A05] leading-tight">
            {title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-2xl leading-relaxed">
            {description}
          </p>
          <p className="mt-4 text-xs sm:text-sm text-gray-400">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* Subcategory chips from mega menu */}
      {subLinks.length > 0 && (
        <section className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateCategory({ slug, filter: menu?.filter || "All" })}
              className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
                !highlightLabel || highlightLabel === menu?.label
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              Shop All
            </button>
            {subLinks.slice(0, 10).map((link) => (
              <button
                key={`${link.label}-${link.filter}`}
                type="button"
                onClick={() =>
                  onNavigateCategory({
                    slug,
                    filter: link.filter,
                    tag: link.tag,
                    label: link.label,
                  })
                }
                className={`text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
                  highlightLabel === link.label
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Promo cards */}
      {menu?.promos?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {menu.promos.map((promo) => (
              <button
                key={promo.title}
                type="button"
                onClick={() =>
                  onNavigateCategory({
                    slug,
                    filter: promo.filter,
                    tag: promo.tag,
                    label: promo.title,
                  })
                }
                className="relative overflow-hidden rounded-2xl text-left group h-36 sm:h-44 bg-[#F4B740]"
              >
                <img
                  src={promo.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" />
                <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-end h-full">
                  <p className="text-[10px] font-bold tracking-[0.18em] text-white/80 uppercase">
                    {promo.subtitle}
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-black text-white mt-1">
                    {promo.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Product grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="flex items-end justify-between gap-4 mb-5">
          <h2 className="font-display text-xl sm:text-2xl font-black text-[#2D1A05]">
            Products
          </h2>
          <span className="text-xs sm:text-sm text-gray-400">{products.length} items</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading products…</div>
        ) : error ? (
          <div className="text-center py-16 text-sm text-red-500">{error}</div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <p className="font-display text-xl font-bold text-gray-800">Coming soon</p>
            <p className="text-sm text-gray-500 mt-2">
              No products in this category yet.
            </p>
            <button
              type="button"
              onClick={onBackToHome}
              className="mt-5 bg-gray-900 text-white font-bold px-5 py-2.5 rounded-full text-sm"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((p) => {
              // Cart lines reference a variant, not a product (Phase 6).
              const cartKey = p.defaultVariantId || p.id;
              const qty = cart[cartKey] || 0;
              const variant = p.variants?.[0] || { price: p.price, mrp: p.mrp, label: p.weight };
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col cursor-pointer"
                  onClick={() => onProductClick(p)}
                >
                  <div className="relative h-32 sm:h-44" style={{ background: p.bg || "#f5f5f5" }}>
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    {p.bestseller && (
                      <span className="absolute top-2 left-2 bg-[#F4B740] text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Best Seller
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{p.name}</h3>
                    <p className="text-xs text-gray-400">{variant.label}</p>
                    <div className="flex items-baseline gap-2 mt-auto pt-1">
                      <span className="text-sm font-bold text-gray-900">₹{variant.price}</span>
                      {variant.mrp > variant.price && (
                        <span className="text-xs text-gray-400 line-through">₹{variant.mrp}</span>
                      )}
                    </div>
                    <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => onFirstAdd(cartKey)}
                          className="w-full bg-[#2C8C82] hover:bg-[#25746c] text-white text-xs font-bold py-2 rounded-full transition-colors"
                        >
                          Add to Cart
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-[#2C8C82] text-white rounded-full px-3 py-1.5">
                          <button type="button" onClick={() => onDec(cartKey)} className="font-bold px-1">−</button>
                          <span className="text-xs font-bold">{qty}</span>
                          <button type="button" onClick={() => onInc(cartKey)} className="font-bold px-1">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
