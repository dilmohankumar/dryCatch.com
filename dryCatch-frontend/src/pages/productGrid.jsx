import { useState, useCallback } from "react";
import { openRazorpay } from "../hooks/useRazorpay.js";
import { isLoggedIn as checkIsLoggedIn } from "../utils/authState.js";

// ── Icons ──────────────────────────────────────────────────────────────────
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
const BuyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const StarIcon = ({ filled }) => (
  <svg className={`w-3 h-3 ${filled ? "text-amber-400" : "text-gray-200"}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);
const LocalIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
  </svg>
);
const ImportIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const discountPct = (p, m) => Math.round(((m - p) / m) * 100);

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold`}
      style={{ animation: "slideUp .25s ease",
        background: toast.type === "success" ? "#16a34a" : toast.type === "auth" ? "#1A3A5C" : "#ef4444",
        color: "white" }}
    >
      <span>{toast.type === "success" ? "✓" : toast.type === "auth" ? "🔒" : "✕"}</span>
      <span className="max-w-[240px]">{toast.message}</span>
      <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100 text-xs font-bold">✕</button>
    </div>
  );
}

// ── useBuyFlow — now accepts onAuthRequired ────────────────────────────────
function useBuyFlow(product, onToast, onAuthRequired) {
  const [status, setStatus] = useState("idle");

  const triggerBuy = useCallback(async (variant, qty) => {
    if (status === "paying") return;

    // ── AUTH CHECK (instant, before any async work) ─────────────────────
    if (!checkIsLoggedIn()) {
      onToast({ message: "Please login to continue with payment", type: "auth" });
      if (onAuthRequired) onAuthRequired(); // navigate("/login")
      return;
    }

    setStatus("paying");
    try {
      await openRazorpay({
        product,
        variant,
        qty,
        onAuthRequired, // also pass so useRazorpay can guard too
        onSuccess: (paymentId) => {
          setStatus("success");
          onToast({
            message: `🎉 Order placed! ID: ${paymentId.slice(0, 18)}…`,
            type: "success",
          });
          setTimeout(() => setStatus("idle"), 3000);
        },
        onFailure: (err) => {
          if (err?.reason === "dismissed") {
            setStatus("idle");
          } else {
            setStatus("failed");
            onToast({ message: "Payment failed. Please try again.", type: "error" });
            setTimeout(() => setStatus("idle"), 2000);
          }
        },
      });
    } catch {
      setStatus("idle");
    }
  }, [product, status, onToast, onAuthRequired]);

  return { status, triggerBuy };
}

// ── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product, qty, onInc, onDec, onFirstAdd, onCardClick, onToast, onAuthRequired }) {
  const variant   = product.variants[0];
  const { status, triggerBuy } = useBuyFlow(product, onToast, onAuthRequired);
  const isPaying  = status === "paying";
  const isSuccess = status === "success";
  const hasItems  = qty > 0;
  const total     = variant.price * (qty || 1);



  return (
    <div
      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col group cursor-pointer"
      onClick={() => onCardClick(product)}
    >
      {/* Image */}
      <div
  className="relative overflow-hidden flex-shrink-0"
  style={{ height: 220 }}
>
<img
  src={product.image}
  alt={product.name}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover"
/>

  {discountPct(product.price, product.mrp) > 0 && (
    <span className="absolute top-2 left-2 bg-[#E07B39] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
      {discountPct(product.price, product.mrp)}% OFF
    </span>
  )}

  {hasItems && (
    <span className="absolute top-2 right-2 bg-[#1A3A5C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
      {qty} in cart
    </span>
  )}
</div>

      {/* Info */}
      <div className="p-2.5 sm:p-3.5 flex flex-col gap-1 flex-1">
        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-gray-400">
          {product.originType === "Locally Sourced" ? <LocalIcon /> : <ImportIcon />}
          <span className="truncate">{product.originType}</span>
        </div>

        <h3 className="font-bold text-gray-900 text-[11px] sm:text-xs leading-snug line-clamp-2">{product.name}</h3>
        <p className="text-[9px] sm:text-[10px] text-gray-500 line-clamp-1 hidden sm:block">{product.desc}</p>
        <p className="text-[9px] sm:text-[10px] text-gray-400">{variant.label}</p>

        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < product.rating} />)}
          <span className="text-[9px] text-gray-400 ml-1">({product.reviews})</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-sm sm:text-base font-extrabold text-gray-900">₹{variant.price}</span>
          <span className="text-[9px] sm:text-[10px] text-gray-400 line-through">₹{variant.mrp}</span>
          {hasItems && (
            <span className="ml-auto text-[9px] sm:text-[10px] font-bold text-[#1A3A5C]">
              Total ₹{total}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>

          {/* Add / Qty stepper */}
          {hasItems ? (
            <div className="flex items-center gap-1 bg-gray-100 rounded-full px-1.5 py-1 flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); onDec(); }}
                className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-[#1A3A5C] transition-colors">
                <MinusIcon />
              </button>
              <span className="text-[11px] font-bold text-gray-800 w-4 text-center tabular-nums">{qty}</span>
              <button onClick={e => { e.stopPropagation(); onInc(); }}
                className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-[#1A3A5C] transition-colors">
                <PlusIcon />
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onFirstAdd(); }}
              className="flex-1 text-[10px] sm:text-xs font-bold py-1.5 rounded-full border-2 border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EAF1FA] transition-all active:scale-95"
            >
              + Add
            </button>
          )}

          {/* Buy button */}
          <button
            onClick={e => { e.stopPropagation(); triggerBuy(variant, qty > 0 ? qty : 1); }}
            disabled={isPaying}
            className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-sm flex-shrink-0
              ${isSuccess
                ? "bg-green-500 text-white"
                : isPaying
                ? "bg-[#1A3A5C]/50 text-white cursor-not-allowed"
                : "bg-[#1A3A5C] text-white hover:bg-[#142d47]"
              }`}
          >
            {isPaying ? (
              <><svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><span className="hidden sm:inline">Paying…</span></>
            ) : isSuccess ? (
              <><CheckIcon /><span className="hidden sm:inline">Done!</span></>
            ) : (
              <><BuyIcon /><span>{hasItems ? `Buy ₹${total}` : `Buy ₹${variant.price}`}</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProductGrid ────────────────────────────────────────────────────────────
// New prop: onAuthRequired — called when Buy clicked without login
export default function ProductGrid({
  products = [],
  cart = {},
  onInc,
  onDec,
  onFirstAdd,
  onProductClick = () => {},
  onAuthRequired,         // ← passed from Home → App → navigate("/login")
}) {
  const [localCart, setLocalCart] = useState({});
  const [toast, setToast]         = useState(null);

  const isControlled = typeof onInc === "function";
  const activeCart   = isControlled ? cart : localCart;
  const handleInc    = isControlled ? onInc      : id => setLocalCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const handleDec    = isControlled ? onDec      : id => setLocalCart(c => { const n=(c[id]||1)-1; return n<=0?{...c,[id]:0}:{...c,[id]:n}; });
  const handleFirst  = isControlled ? onFirstAdd : id => setLocalCart(c => ({ ...c, [id]: 1 }));

  const showToast = useCallback((t) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-5">
        {products.map(p => {
          // Cart lines reference a variant, not a product (Phase 6) — cards
          // add/track the product's default variant, resolved server-side
          // in a single batched query per listing page (see productService.js),
          // not one extra fetch per card.
          const cartKey = p.defaultVariantId || p.id;
          return (
            <ProductCard
              key={p.id}
              product={p}
              qty={activeCart[cartKey] || 0}
              onInc={() => handleInc(cartKey)}
              onDec={() => handleDec(cartKey)}
              onFirstAdd={() => handleFirst(cartKey)}
              onCardClick={onProductClick}
              onToast={showToast}
              onAuthRequired={onAuthRequired}  // ← passed to card → useBuyFlow
            />
          );
        })}
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </>
  );
}