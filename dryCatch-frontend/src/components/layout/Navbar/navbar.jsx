import { useState, useEffect, useRef } from "react";
import { PRIMARY_NAV } from "../../../data/megaMenu.js";
import { SECONDARY_NAV } from "../../../data/homeData.js";
import { getMegaMenu } from "../../../data/megaMenu.js";
import Logo from "../Logo.jsx";
import MegaMenu from "./MegaMenu.jsx";
import SearchBar from "./SearchBar.jsx";
import NotificationBell from "../../notifications/NotificationBell.jsx";

// ── Icons ──────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
    />
  </svg>
);
const CartIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);
const UserIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
    />
  </svg>
);
const ChevronDownIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);
const ChevronRightIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.5}
      d="M9 5l7 7-7 7"
    />
  </svg>
);
const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);
const CloseIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const XIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const PlusIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);
const MinusIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 12H4"
    />
  </svg>
);
const TrashIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);
const BoltIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);
const LogoutIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);
const OrdersIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

// ── Cart Drawer ────────────────────────────────────────────────────────────
// items/summary come straight from the server (GET /cart) — see
// cartService.getCartSummary — never reconstructed from a client-side
// product cache. Price/subtotal/availability are all backend-authoritative.
function CartDrawer({ items = [], summary, onInc, onDec, onRemove, onClose, onGoToCart }) {
  const subtotal = summary?.subtotal ?? 0;
  const delivery = subtotal >= 500 || subtotal === 0 ? 0 : 49;
  const grandTotal = subtotal + delivery;

  const handleCheckout = () => {
    onClose();
    onGoToCart();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-sm sm:max-w-md h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CartIcon />
            <h2 className="text-base font-bold text-gray-900">Your Cart</h2>
            {items.length > 0 && (
              <span className="bg-[#1A3A5C] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Free delivery bar */}
        {subtotal > 0 && subtotal < 500 && (
          <div className="px-5 py-3 bg-blue-50 flex-shrink-0">
            <div className="flex justify-between text-xs text-blue-700 mb-1.5">
              <span>Add ₹{500 - subtotal} more for free delivery</span>
              <span className="font-bold">
                {Math.round((subtotal / 500) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1A3A5C] rounded-full transition-all duration-500"
                style={{ width: `${Math.min((subtotal / 500) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        {subtotal >= 500 && (
          <div className="px-5 py-2.5 bg-green-50 flex-shrink-0">
            <p className="text-xs text-green-700 font-semibold">
              ✓ You've unlocked free delivery!
            </p>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🛒</div>
              <p className="text-gray-500 font-medium">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">
                Add some Dry Catch to get started
              </p>
              <button
                onClick={onClose}
                className="mt-5 bg-[#1A3A5C] text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-[#142d47] transition-colors"
              >
                Browse Products
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-sm bg-gray-100">
                  {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {item.productName}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {item.variantLabel}
                  </p>
                  {item.availability !== "IN_STOCK" && (
                    <p className="text-[10px] font-semibold text-amber-600 mt-0.5">
                      {item.availability === "OUT_OF_STOCK" && "Out of stock"}
                      {item.availability === "INSUFFICIENT_STOCK" && `Only ${item.maxAvailable} available`}
                      {item.availability === "LOW_STOCK" && "Low stock"}
                      {(item.availability === "PRODUCT_UNAVAILABLE" || item.availability === "VARIANT_UNAVAILABLE") && "No longer available"}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-extrabold text-gray-900">
                      ₹{item.lineSubtotal}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onRemove(item.variantId)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2 py-1">
                    <button
                      onClick={() => onDec(item.variantId)}
                      className="text-gray-500 hover:text-[#1A3A5C] transition-colors"
                    >
                      <MinusIcon />
                    </button>
                    <span className="text-xs font-bold w-4 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onInc(item.variantId)}
                      className="text-gray-500 hover:text-[#1A3A5C] transition-colors"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary + checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>
                  Subtotal ({items.reduce((s, i) => s + i.quantity, 0)}{" "}
                  items)
                </span>
                <span className="font-semibold text-gray-800">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery</span>
                <span
                  className={`font-semibold ${delivery === 0 ? "text-green-600" : "text-gray-800"}`}
                >
                  {delivery === 0 ? "FREE" : `₹${delivery}`}
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
                <span>Total</span>
                <span>₹{grandTotal}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl text-sm transition-all active:scale-[0.98] shadow-lg bg-[#E07B39] text-white hover:bg-[#c96a2c]"
            >
              <BoltIcon />
              View Cart · ₹{grandTotal}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Dropdown ──────────────────────────────────────────────────────────
const WishlistIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);

function UserDropdown({ user, onLogout, onClose, onNavigate }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  const handleNavigate = (page) => {
    onNavigate(page);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden"
    >
      {/* User info */}
      <div className="px-4 py-3 border-b border-gray-100 bg-[#EAF1FA]">
        <p className="text-sm font-bold text-gray-900 truncate">
          {user?.name || "User"}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {user?.email || user?.phone || ""}
        </p>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <button
          onClick={() => handleNavigate("orders")}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <OrdersIcon /> My Orders
        </button>
        <button
          onClick={() => handleNavigate("wishlist")}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <WishlistIcon /> My Wishlist
        </button>
        <button
          onClick={() => handleNavigate("profile")}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <UserIcon /> My Profile
        </button>
      </div>

      <div className="border-t border-gray-100 py-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
        >
          <LogoutIcon /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
// Props:
//   onOpenSidebar  — opens mobile sidebar drawer
//   cart           — { [id]: qty }
//   onCartInc/Dec/Remove — cart handlers
//   onLogoClick    — navigate to home
//   onLoginClick   — navigate to /login
//   onLogout       — clears token + navigates to /login
export default function Navbar({
  onOpenSidebar,
  cart = {},
  cartItems = [],
  cartSummary,
  onCartInc,
  onCartDec,
  onCartRemove,
  onLogoClick,
  onLoginClick,
  onLogout,
  onNavigate,
  onCategorySelect = () => {},
  user = null,
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openMenuSlug, setOpenMenuSlug] = useState(null);
  // Category nav strips (primary + secondary). No side drawer.
  // Scroll down → hide. ☰ click → toggle show/hide.
  const [chromeHidden, setChromeHidden] = useState(false);
  const [stripsVisible, setStripsVisible] = useState(true);
  // ☰/X toggle only shows once the strip has auto-hidden on scroll — at the
  // top of the page the strip is already visible, so there's nothing to toggle.
  const [showMenuToggle, setShowMenuToggle] = useState(false);
  const lastScrollY = useRef(0);
  const fixedHeaderRef = useRef(null);
  const [fixedHeaderHeight, setFixedHeaderHeight] = useState(0);

  // `user` is owned by App (routes/AppRoutes.jsx) and passed down as a prop —
  // Navbar used to independently fetch/cache its own copy via apiGetMe, which
  // could drift out of sync with App's copy (e.g. logout in one place not
  // reflected in the other). Single source of truth now lives in App.
  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
  };

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  // Initials avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";

  const isLoggedIn = !!user;

  // Scroll down → hide announcement + category strips (main header stays).
  // ☰ click → toggle category strips only (no side drawer).
  //
  // The fixed header's height reservation (see spacer below) grows/shrinks
  // when the strip collapses/expands, and that resize itself nudges
  // window.scrollY (the browser's scroll-anchoring kicks in even mid CSS
  // transition). Left unguarded, that self-inflicted scroll delta looked
  // like the user scrolling down and immediately re-hid the strip that was
  // just opened by a click. suppressScrollUntilRef mutes the listener for
  // a moment after any manual toggle so it only reacts to real user scrolls.
  const suppressScrollUntilRef = useRef(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (performance.now() < suppressScrollUntilRef.current) {
          lastScrollY.current = y;
          ticking = false;
          return;
        }
        const delta = y - lastScrollY.current;
        if (y > 48 && delta > 4) {
          setChromeHidden(true);
          setStripsVisible(false);
          setShowMenuToggle(true);
          setOpenMenuSlug(null);
        } else if (y < 10) {
          setChromeHidden(false);
          setStripsVisible(true);
          setShowMenuToggle(false);
        }
        lastScrollY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleMenuClick = () => {
    // Mute the auto-hide scroll listener while the collapse animation runs.
    suppressScrollUntilRef.current = performance.now() + 500;
    setStripsVisible((v) => !v);
    setOpenMenuSlug(null);
  };

  // Measure the fixed header's rendered height so the spacer below can
  // reserve the same amount of space (height changes as strips collapse).
  useEffect(() => {
    const el = fixedHeaderRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setFixedHeaderHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="font-sans w-full shrink-0 bg-white">
      {/* Announcement — hides on scroll */}
      <div
        className={`chrome-collapse ${chromeHidden ? "is-collapsed" : ""}`}
        aria-hidden={chromeHidden}
      >
        <div className="chrome-collapse-inner">
          <div className="bg-black text-white text-[11px] sm:text-[12px]">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous announcement"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  aria-label="Next announcement"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <ChevronRightIcon />
                </button>
                <p className="font-medium tracking-wide">
                  FREE shipping on orders over ₹999!
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-5 text-white/85">
                <button
                  type="button"
                  className="hover:text-white transition-colors"
                >
                  Dry Catch For Business
                </button>
                <button
                  type="button"
                  className="hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  Help <ChevronDownIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed: main header ALWAYS visible. Category strips toggle under it. */}
      <div
        ref={fixedHeaderRef}
        className="fixed top-0 inset-x-0 z-[100] bg-white shadow-sm"
      >
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-5">
            {/* ☰ — only shown once the strip has auto-hidden on scroll; at the
                top of the page the strip is already visible, so there's
                nothing to toggle. Click pe category strips show/hide (no side drawer) */}
            {showMenuToggle && (
              <button
                type="button"
                onClick={handleMenuClick}
                className="text-gray-900 hover:opacity-70 transition-opacity shrink-0"
                aria-label={
                  stripsVisible ? "Hide categories" : "Show categories"
                }
                aria-expanded={stripsVisible}
              >
                {stripsVisible ? <CloseIcon /> : <MenuIcon />}
              </button>
            )}

            <button
              onClick={onLogoClick}
              className="shrink-0"
              aria-label="dryCatch home"
            >
              <Logo />
            </button>

            <SearchBar className="flex-1 max-w-xl lg:max-w-2xl" />

            <nav className="flex items-center gap-4 sm:gap-5 shrink-0">
              {isLoggedIn && <NotificationBell onNavigate={onNavigate} />}
              {isLoggedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen((d) => !d)}
                    className="flex items-center gap-1.5 text-gray-900 hover:opacity-70 transition-opacity"
                    title={user?.name || user?.email}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1A3A5C] text-white flex items-center justify-center text-[11px] font-bold">
                      {initials}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium">
                      Account
                    </span>
                  </button>
                  {dropdownOpen && (
                    <UserDropdown
                      user={user}
                      onLogout={handleLogout}
                      onClose={() => setDropdownOpen(false)}
                      onNavigate={onNavigate}
                    />
                  )}
                </div>
              ) : (
                <button
                  onClick={onLoginClick}
                  className="flex items-center gap-1.5 text-gray-900 hover:opacity-70 transition-opacity"
                >
                  <UserIcon />
                  <span className="hidden sm:inline text-sm font-medium">
                    Sign in
                  </span>
                </button>
              )}

              <button
                onClick={() => onNavigate("orders")}
                className="hidden sm:flex items-center gap-1.5 text-gray-900 hover:opacity-70 transition-opacity"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm font-medium">Reorder</span>
              </button>

              <button
                onClick={() => onNavigate("cart")}
                className="relative flex items-center gap-1.5 text-gray-900 hover:opacity-70 transition-opacity"
              >
                <span className="relative">
                  <CartIcon />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-[#F4B740] text-gray-900 text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline text-sm font-medium">
                  Cart
                </span>
              </button>
            </nav>
          </div>
        </header>

        {/* Category strips — ☰ click se show/hide */}
        <div
          className={`chrome-collapse ${stripsVisible ? "" : "is-collapsed"}`}
          aria-hidden={!stripsVisible}
          onMouseLeave={() => setOpenMenuSlug(null)}
        >
          <div
            className="chrome-collapse-inner"
            style={openMenuSlug ? { overflow: "visible" } : undefined}
          >
            <div>
              <div className="relative border-b border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto px-3 sm:px-6">
                  <nav className="flex items-center justify-start sm:justify-center gap-5 sm:gap-6 lg:gap-8 overflow-x-auto scrollbar-hide">
                    {PRIMARY_NAV.map((item) => {
                      const active = openMenuSlug === item.slug;
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          onMouseEnter={() =>
                            stripsVisible && setOpenMenuSlug(item.slug)
                          }
                          onClick={() => {
                            setOpenMenuSlug(null);
                            onCategorySelect({
                              slug: item.slug,
                              filter: item.filter,
                              label: item.label,
                            });
                          }}
                          className="relative text-sm font-bold text-gray-900 py-3 whitespace-nowrap hover:opacity-70 transition-opacity"
                        >
                          {item.label}
                          <span
                            className={`absolute left-0 right-0 bottom-0 h-[3px] bg-[#F4B740] transition-opacity ${
                              active ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {stripsVisible && openMenuSlug && (
                  <MegaMenu
                    menu={getMegaMenu(openMenuSlug)}
                    onNavigate={onCategorySelect}
                    onClose={() => setOpenMenuSlug(null)}
                  />
                )}
              </div>

              <div className="bg-[#F3E9D8] border-b border-[#E8DCC8]">
                <div className="max-w-7xl mx-auto px-6">
                  <nav className="flex items-center justify-center gap-0 py-2 overflow-x-auto scrollbar-hide">
                    {SECONDARY_NAV.map((item, i) => (
                      <div key={item.label} className="flex items-center">
                        {i > 0 && (
                          <span className="text-gray-300 px-2.5 select-none">
                            |
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onCategorySelect(item)}
                          className="text-[12px] text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap px-1"
                        >
                          {item.label}
                        </button>
                      </div>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer — reserves space in normal flow so fixed header doesn't cover content.
          overflow-anchor: none stops the browser from shifting scroll position when
          this element's height changes (which was re-triggering the scroll listener
          and instantly re-collapsing the strips right after opening them). */}
      <div style={{ height: fixedHeaderHeight, overflowAnchor: "none" }} />

      {cartOpen && (
        <CartDrawer
          items={cartItems}
          summary={cartSummary}
          onInc={onCartInc}
          onDec={onCartDec}
          onRemove={onCartRemove}
          onClose={() => setCartOpen(false)}
          onGoToCart={() => onNavigate("cart")}
        />
      )}
    </div>
  );
}
