import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { openRazorpay } from "../hooks/useRazorpay.js";
import { variantsAPI, growthAPI } from "../utils/api.js";
import { trackProductView, trackAddToCart } from "../utils/analyticsClient.js";
import { useSEO } from "../hooks/useSEO.js";
import StockBadge from "../components/StockBadge.jsx";
import ProductReviews from "../components/reviews/ProductReviews.jsx";
import ProductRecommendations from "../components/growth/ProductRecommendations.jsx";
import StockAlertButton from "../components/growth/StockAlertButton.jsx";
import bombayDuckImage from "../assets/bombay-duck.jpg";
import dryPrawnsImage from "../assets/Dry-Prawns.jpg";

// ── Icons ──────────────────────────────────────────────────────────────────
const ShareIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const MinusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);
const StarIcon = ({ filled }) => (
  <svg className={`w-4 h-4 ${filled ? "text-amber-400" : "text-gray-200"}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const TruckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m0 0h3l3 4v4h-3m0 0a2 2 0 11-4 0m4 0a2 2 0 01-4 0M9 17a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const SparkleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);
const BoltIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// ── Peace of mind ──────────────────────────────────────────────────────────
const PROMISES = [
  { icon: <TruckIcon />,   title: "Next Day Morning Delivery", desc: "Order before 11:59 PM and get next day morning delivery starting at 6 AM" },
  { icon: <SparkleIcon />, title: "Sun-Dried & Natural",       desc: "Processed without any chemicals or preservatives. Pure is the way to go" },
  { icon: <ShieldIcon />,  title: "FSSAI Certified",           desc: "Quality control for every order done by our experienced FSSAI certified team" },
];

const discountPct = (p, m) => Math.round(((m - p) / m) * 100);

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold
        ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}
      style={{ animation: "slideUp .25s ease" }}
    >
      <span>{toast.type === "success" ? "✓" : "✕"}</span>
      <span className="max-w-[260px]">{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100">✕</button>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

// ── Helper function to get product image ───────────────────────────────────
const getProductImage = (productName) => {
  if (!productName) return bombayDuckImage;
  
  const name = productName.toLowerCase();
  if (name.includes("prawn") || name.includes("shrimp")) {
    return dryPrawnsImage;
  }
  // Add more conditions for other products here
  // if (name.includes("bombay") || name.includes("duck")) {
  //   return bombayDuckImage;
  // }
  
  return bombayDuckImage; // default image
};

// ── ProductDetail ──────────────────────────────────────────────────────────
// Props:
//   product          — full normalized product object (from productsAPI)
//   onBack           — () => void  — back to home
//   cart             — { [productId]: qty }  — global cart from App
//   onCartInc        — (variantId) => void
//   onCartDec        — (variantId) => void
//   onCartFirstAdd   — (variantId) => void
export default function ProductDetail({
  product,
  onBack,
  cart = {},
  onCartInc,
  onCartDec,
  onCartFirstAdd,
  user,
}) {
  const [slide, setSlide]                   = useState(0);
  const [realVariants, setRealVariants]     = useState(null); // null = still loading
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [availabilityById, setAvailabilityById] = useState({}); // { [variantId]: {available, status} }
  const [buyStatus, setBuyStatus]           = useState("idle"); // idle | paying | success | failed
  const [toast, setToast]                   = useState(null);
  const navigate = useNavigate();

  // Phase 17 — one PRODUCT_VIEW per page mount, not per re-render.
  // Phase 24 — same trigger records into the recently-viewed rail; a
  // separate call (not folded into trackProductView) because it's a
  // distinct feature with its own storage/read path, not an analytics event.
  useEffect(() => {
    if (product?.id) {
      trackProductView(product.id);
      growthAPI.recordView(product.id);
    }
  }, [product?.id]);

  // Phase 23 — Product + Breadcrumb structured data, title/description/
  // canonical/OG. Built from data already fetched for rendering — no
  // extra request just for SEO metadata.
  useSEO({
    title: product?.seo?.title || (product ? `${product.name}${product.category ? ` | ${product.category}` : ""} | DryCatch` : undefined),
    description: product?.seo?.description || product?.shortDescription || product?.description,
    canonical: product?.slug ? `/products/${product.slug}` : undefined,
    ogImage: product?.image,
    ogType: "product",
    jsonLd: product
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.shortDescription || product.description,
            image: product.image ? [product.image] : undefined,
            brand: { "@type": "Brand", name: "DryCatch" },
            offers: {
              "@type": "Offer",
              url: `${window.location.origin}/products/${product.slug || product.id}`,
              priceCurrency: "INR",
              price: String(product.variants?.[0]?.price ?? product.price ?? ""),
              availability: product.variants?.[0]?.available !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
            ...(product.reviews > 0 && product.rating > 0
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(product.rating), reviewCount: String(product.reviews) } }
              : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin },
              ...(product.category ? [{ "@type": "ListItem", position: 2, name: product.category, item: `${window.location.origin}/shop` }] : []),
              { "@type": "ListItem", position: (product.category ? 3 : 2), name: product.name, item: `${window.location.origin}/products/${product.slug || product.id}` },
            ],
          },
        ]
      : undefined,
  });

  // Real variants live in their own collection now (see Phase 4) — fetched
  // separately from the product itself, per the Product→Variant boundary.
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    variantsAPI
      .getAll(product.id)
      .then(({ variants }) => {
        if (cancelled) return;
        setRealVariants(variants || []);
        const initial = variants?.find((v) => v.isDefault) || variants?.[0];
        setSelectedVariantId(initial?.id ?? null);

        // A product detail page has a handful of variants at most, not a
        // grid of cards — fetching each one's availability here doesn't
        // create the N+1 problem a listing page would (see docs/inventory.md).
        Promise.all(
          (variants || []).map((v) =>
            variantsAPI
              .getAvailability(product.id, v.id)
              .then((a) => [v.id, a])
              .catch(() => [v.id, null])
          )
        ).then((pairs) => {
          if (cancelled) return;
          setAvailabilityById(Object.fromEntries(pairs.filter(([, a]) => a)));
        });
      })
      .catch(() => {
        if (!cancelled) setRealVariants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  // Guard against missing product prop
  if (!product) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Product not found</p>
          <button onClick={onBack} className="mt-4 text-[#1A3A5C] underline">Go back</button>
        </div>
      </div>
    );
  }

  // Prefer real variants (from the ProductVariant API); while they're
  // loading (or if a product genuinely has none), fall back to the
  // synthetic single-entry array productAdapters builds from base price.
  const variants = (realVariants && realVariants.length > 0) ? realVariants : (product.variants || []);
  const variantLabel = (v) => v?.weight?.label || v?.label || "";
  // A variant option is selectable only if it's an active/listed variant AND
  // inventory says it's actually in stock — availabilityById is empty for
  // the synthetic fallback (no real variant id to look up), so those always
  // pass through as available rather than being blocked by a missing entry.
  const isVariantAvailable = (v) => {
    const id = v.id ?? v._id;
    const isActiveVariant = v.status === undefined || v.status === "active";
    const stock = availabilityById[id];
    return isActiveVariant && (!stock || stock.available);
  };
  const variant =
    variants.find((v) => (v.id ?? v._id) === selectedVariantId) ||
    variants.find(isVariantAvailable) ||
    variants[0] ||
    { price: 0, mrp: 0 };
  const selectedAvailability = availabilityById[variant.id ?? variant._id];
  const isOutOfStock = selectedAvailability?.available === false;
  // slides array from product, default to empty array
  const slides = product.slides || [];
  
  // Get the appropriate image for this product
  const productImage = getProductImage(product.name);
  
  // Cart lines reference the VARIANT, not the product (Phase 6) — qty must
  // be looked up by the selected variant's id, not product.id.
  const variantId = variant?.id ?? variant?._id;
  const qty      = cart[variantId] || 0;
  const total    = variant.price * (qty || 1);
  const isPaying  = buyStatus === "paying";
  const isSuccess = buyStatus === "success";

  const showToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  // ── Add to cart (syncs to the server cart via App) ─────────────────────
  const handleFirstAdd = () => {
    if (onCartFirstAdd) onCartFirstAdd(variantId);
    trackAddToCart(product?.id, 1);
  };
  const handleInc = () => {
    if (onCartInc) onCartInc(variantId);
  };
  const handleDec = () => {
    if (onCartDec) onCartDec(variantId);
  };

  // ── Buy now via Razorpay ───────────────────────────────────────────────
  const handleBuy = useCallback(async () => {
    if (isPaying) return;
    setBuyStatus("paying");
    try {
      await openRazorpay({
        product,
        variant: { ...variant, label: variantLabel(variant) },
        qty: qty > 0 ? qty : 1,
        onSuccess: (paymentId) => {
          setBuyStatus("success");
          showToast({
            message: `🎉 Order placed! Payment ID: ${paymentId.slice(0, 18)}…`,
            type: "success",
          });
          setTimeout(() => setBuyStatus("idle"), 3000);
        },
        onFailure: (err) => {
          if (err?.reason === "dismissed") {
            setBuyStatus("idle");
          } else {
            setBuyStatus("failed");
            showToast({ message: "Payment failed. Please try again.", type: "error" });
            setTimeout(() => setBuyStatus("idle"), 2000);
          }
        },
      });
    } catch {
      setBuyStatus("idle");
    }
  }, [product, variant, qty, isPaying]);

  // ── Slide navigation ───────────────────────────────────────────────────
  const prevSlide = () => {
    if (!slides.length) return;
    setSlide((s) => (s - 1 + slides.length) % slides.length);
  };
  
  const nextSlide = () => {
    if (!slides.length) return;
    setSlide((s) => (s + 1) % slides.length);
  };

  // ── Share ──────────────────────────────────────────────────────────────
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, text: product.desc, url: window.location.href });
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast({ message: "Link copied to clipboard!", type: "success" });
    }
  };

  return (
    <div className="bg-white min-h-screen font-sans">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* ── Breadcrumb ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-5 pb-2">
        <nav className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 flex-wrap">
          <button
            onClick={onBack}
            className="hover:text-gray-700 transition-colors flex items-center gap-1 font-medium"
          >
            <BackIcon /> Home
          </button>
          <span>›</span>
          <span className="hover:text-gray-700 cursor-pointer transition-colors">{product.category || "Dry Catch"}</span>
          <span>›</span>
          <span className="text-gray-700 font-medium truncate max-w-[160px] sm:max-w-xs">
            {product.name.toLowerCase().replace(/\s+/g, "-")}
          </span>
        </nav>
      </div>

      {/* ── Hero: image + info ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-start">

        {/* Left — image slider */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full p-2 text-gray-500 hover:text-[#1A3A5C] transition-colors shadow-sm"
          >
            <ShareIcon />
          </button>

          <div
            className="rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden w-full"
            style={{ background: product.bg || "#f5f5f5", minHeight: 280 }}
          >
            {/* Dynamically show image based on product */}
            <img 
              src={productImage}
              className="w-full h-auto max-h-[280px] sm:max-h-[360px] object-contain" 
              alt={product.name} 
            />
          </div>

          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-5">
              <div className="flex items-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={`rounded-full transition-all ${i === slide ? "w-3 h-3 bg-[#1A3A5C]" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"}`}
                  />
                ))}
              </div>
              <div className="flex gap-2 ml-3">
                <button onClick={prevSlide} className="border border-gray-200 rounded-lg p-2 text-gray-500 hover:border-[#1A3A5C] hover:text-[#1A3A5C] transition-colors bg-white">
                  <ChevronLeftIcon />
                </button>
                <button onClick={nextSlide} className="border border-gray-200 rounded-lg p-2 text-gray-500 hover:border-[#1A3A5C] hover:text-[#1A3A5C] transition-colors bg-white">
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — product info */}
        <div className="flex flex-col gap-4 sm:gap-5">

          {/* Name */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-snug">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{variant.label}</p>
          </div>

          {/* Origin */}
          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
            <span>🌍</span>
            <span className="font-medium">{product.origin}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs bg-[#EAF1FA] text-[#1A3A5C] font-medium px-2 py-0.5 rounded-full">
              {product.originType}
            </span>
          </div>

          {/* Stars */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < (product.rating || 0)} />)}
            </div>
            <span className="text-sm text-gray-500">({product.reviews || 0} reviews)</span>
          </div>

          {/* Variant selector */}
          {variants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Weight</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select weight">
                {variants.map((v) => {
                  const id = v.id ?? v._id ?? v.label;
                  const isSelected = id === selectedVariantId || (!selectedVariantId && v === variant);
                  const available = isVariantAvailable(v);
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!available}
                      onClick={() => available && setSelectedVariantId(id)}
                      className={`flex items-center gap-2 border rounded-xl px-3 sm:px-4 py-2 text-sm font-medium transition-all ${
                        !available
                          ? "border-gray-100 text-gray-300 cursor-not-allowed line-through"
                          : isSelected
                          ? "border-[#1A3A5C] bg-[#1A3A5C] text-white"
                          : "border-gray-200 text-gray-700 hover:border-[#1A3A5C]"
                      }`}
                    >
                      <span>{variantLabel(v)}</span>
                      {available ? (
                        <span className={isSelected ? "text-white/70" : "text-gray-400"}>— ₹{v.price}</span>
                      ) : (
                        <span className="text-gray-300">Unavailable</span>
                      )}
                      {isSelected && available && <span className="ml-1 bg-white/20 rounded-full p-0.5"><CheckIcon /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price row */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">₹{variant.price}</span>
            <span className="text-base text-gray-400 line-through">₹{variant.mrp}</span>
            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              {discountPct(variant.price, variant.mrp)}% OFF
            </span>
            {selectedAvailability && <StockBadge status={selectedAvailability.status} />}
            {qty > 0 && (
              <span className="text-sm font-bold text-[#1A3A5C] bg-[#EAF1FA] px-2 py-0.5 rounded-full">
                {qty} in cart · ₹{variant.price * qty}
              </span>
            )}
          </div>

          {/* ── Add to cart row ── */}
          <div className="flex flex-col gap-3">
            {isOutOfStock ? (
              <>
                <button
                  disabled
                  className="w-full py-3.5 rounded-2xl font-bold text-base sm:text-lg border-2 border-gray-200 text-gray-400 cursor-not-allowed"
                >
                  Out of Stock
                </button>
                <StockAlertButton productId={product.id} variantId={variantId} user={user} onToast={showToast} />
              </>
            ) : qty === 0 ? (
              /* First add */
              <button
                onClick={handleFirstAdd}
                className="w-full py-3.5 rounded-2xl font-bold text-base sm:text-lg border-2 border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EAF1FA] active:scale-[0.98] transition-all"
              >
                + Add to Cart
              </button>
            ) : (
              /* Qty stepper */
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 sm:gap-4 bg-[#1A3A5C] rounded-2xl px-4 sm:px-5 py-3 flex-1 justify-between">
                  <button
                    onClick={handleDec}
                    className="text-white hover:text-[#E07B39] transition-colors"
                  >
                    <MinusIcon />
                  </button>
                  <span className="text-white text-xl font-bold tabular-nums">{qty}</span>
                  <button
                    onClick={handleInc}
                    className="text-white hover:text-[#E07B39] transition-colors"
                  >
                    <PlusIcon />
                  </button>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-base font-extrabold text-gray-900">₹{variant.price * qty}</p>
                </div>
              </div>
            )}

            {/* ── Buy Now button ── always visible, amount reflects qty ── */}
            <button
              onClick={handleBuy}
              disabled={isPaying || isOutOfStock}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base sm:text-lg transition-all active:scale-[0.98] shadow-md
                ${isOutOfStock
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                  : isSuccess
                  ? "bg-green-500 text-white"
                  : isPaying
                  ? "bg-[#1A3A5C]/60 text-white cursor-not-allowed"
                  : buyStatus === "failed"
                  ? "bg-red-500 text-white"
                  : "bg-[#E07B39] text-white hover:bg-[#c96a2c]"
                }`}
            >
              {isPaying ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Opening Payment…
                </>
              ) : isSuccess ? (
                <>✓ Order Placed!</>
              ) : buyStatus === "failed" ? (
                <>✕ Failed — Retry</>
              ) : (
                <>
                  <BoltIcon />
                  Buy Now · ₹{qty > 0 ? variant.price * qty : variant.price}
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              🔒 Secured by Razorpay · UPI · Cards · Net Banking · Wallets
            </p>
          </div>

          {/* Delivery note */}
          <div className="flex items-start sm:items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
            <TruckIcon />
            <span>Free delivery on orders above ₹500 · Next-day morning delivery</span>
          </div>
        </div>
      </div>

      {/* ── Below fold ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 border-t border-gray-100 space-y-10 sm:space-y-12">

        {/* Description */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Description</h2>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{product.description}</p>
        </section>

        {/* How We Pick */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">How We Pick The Best For You?</h2>
          <ul className="space-y-2">
          {(product.howWePickTheBest || []).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600 text-sm sm:text-base">
                <span className="text-gray-400 mt-0.5 flex-shrink-0">–</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* How to Use */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">How To Use</h2>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{product.howToUse}</p>
        </section>

        {/* Shelf Life */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Shelf Life and Storage</h2>
          <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{product.shelfLife}</p>
        </section>

        {/* Lifestyle cards */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Get drycatch</h2>
          <p className="text-gray-500 mt-1 mb-5 text-sm">Meet your lifestyle needs with us</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { bg: "#EAF1FA", title: "how drycatch helps with your lifestyle needs",              emoji: "🐟" },
              { bg: "#1A3A5C", title: "What's right for me? Learn what fish works for a healthier you", emoji: "💡", dark: true },
              { bg: "#FFF4E6", title: "Find exactly what you need — curated Dry Catch for every dish",   emoji: "🎯" },
              { bg: "#E07B39", title: "Enjoyment meets convenience — kits & recipes to save time",      emoji: "🎁", dark: true },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 cursor-pointer hover:scale-[1.02] transition-transform min-h-[130px] sm:min-h-[160px]"
                style={{ background: card.bg }}
              >
                <p className={`text-xs sm:text-sm font-semibold leading-snug ${card.dark ? "text-white" : "text-gray-800"}`}>
                  {card.title}
                </p>
                <span className="text-2xl sm:text-3xl">{card.emoji}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Peace of mind */}
        <section className="pb-6 sm:pb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">drycatch with Peace of Mind</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mt-4 sm:mt-5">
            {PROMISES.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 sm:gap-3 text-[#1A3A5C] mb-2 sm:mb-3">
                  {p.icon}
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">{p.title}</h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                <button className="mt-3 sm:mt-4 text-xs sm:text-sm text-[#1A3A5C] font-semibold flex items-center gap-1 hover:underline">
                  Details <ChevronRightIcon />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Reviews & Ratings */}
        <section>
          <ProductReviews productId={product.id} user={user} />
        </section>

        {/* Recommendations (Phase 24) */}
        <ProductRecommendations
          productId={product.id}
          onSelectProduct={(p) => navigate(`/product/${p.slug || p._id}`)}
        />

        {/* Sticky bottom CTA on mobile */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-100 px-4 py-3 flex gap-3 z-30 shadow-lg">
          {isOutOfStock ? (
            <button disabled className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-400 cursor-not-allowed">
              Out of Stock
            </button>
          ) : qty === 0 ? (
            <button
              onClick={handleFirstAdd}
              className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EAF1FA] transition-all"
            >
              + Add to Cart
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#1A3A5C] rounded-2xl px-4 py-2.5 flex-1 justify-between">
              <button onClick={handleDec} className="text-white"><MinusIcon /></button>
              <span className="text-white font-bold tabular-nums">{qty}</span>
              <button onClick={handleInc} className="text-white"><PlusIcon /></button>
            </div>
          )}
          <button
            onClick={handleBuy}
            disabled={isPaying || isOutOfStock}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm transition-all shadow
              ${isOutOfStock ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none" : isSuccess ? "bg-green-500 text-white" : isPaying ? "bg-[#E07B39]/60 text-white cursor-not-allowed" : "bg-[#E07B39] text-white hover:bg-[#c96a2c]"}`}
          >
            {isPaying ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Paying…</>
            ) : isSuccess ? "✓ Done!" : (
              <>⚡ Buy ₹{qty > 0 ? variant.price * qty : variant.price}</>
            )}
          </button>
        </div>

        {/* Bottom padding so content not hidden behind sticky bar on mobile */}
        <div className="h-16 md:hidden" />
      </div>
    </div>
  );
}