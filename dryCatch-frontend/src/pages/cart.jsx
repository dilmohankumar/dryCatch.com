import { useState, useEffect } from "react";
import { cartAPI } from "../utils/api";
import { useSEO } from "../hooks/useSEO.js";

// Backend cart shape (Phase 6): GET /cart → { success, data: { cartId, items, summary } }
// Every item is already enriched (name/image/price/availability) and every
// number (unitPrice/lineSubtotal/summary.subtotal) is server-computed —
// this page never calculates a price itself, only displays what the
// backend sent.
const AVAILABILITY_LABEL = {
  OUT_OF_STOCK: "Out of stock",
  INSUFFICIENT_STOCK: null, // handled specially below (shows maxAvailable)
  LOW_STOCK: "Low stock",
  PRODUCT_UNAVAILABLE: "No longer available",
  VARIANT_UNAVAILABLE: "No longer available",
};

export default function CartPage({ onCheckout, onContinueShopping, onCartChange }) {
  // Phase 23 — user-specific, non-canonical page (rule #15's explicit
  // "prevent crawling: cart, checkout, account").
  useSEO({ title: "Your Cart | DryCatch", robots: "noindex,nofollow" });
  const [cart, setCart] = useState({ items: [], summary: { subtotal: 0, total: 0, currency: "INR" } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      setLoading(true);
      const { data } = await cartAPI.get();
      setCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    setError("");
    try {
      const { data } = quantity <= 0 ? await cartAPI.removeItem(itemId) : await cartAPI.setItemQuantity(itemId, quantity);
      setCart(data);
      onCartChange?.();
    } catch (err) {
      setError(err.message || "Unable to update your cart.");
    }
  };

  const removeItem = async (itemId) => {
    setError("");
    try {
      const { data } = await cartAPI.removeItem(itemId);
      setCart(data);
      onCartChange?.();
    } catch (err) {
      setError(err.message || "Unable to remove this item.");
    }
  };

  const clearCart = async () => {
    if (!confirm("Clear entire cart?")) return;
    try {
      const { data } = await cartAPI.clear();
      setCart(data);
      onCartChange?.();
    } catch (err) {
      setError(err.message || "Unable to clear your cart.");
    }
  };

  const { items, summary } = cart;
  const hasUnavailableItems = items.some((i) => i.availability !== "IN_STOCK" && i.availability !== "LOW_STOCK");

  if (loading) return <div className="p-8 text-center text-gray-400">Loading cart...</div>;

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <div className="text-4xl mb-3">🛒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Explore our products and find something you'll love.</p>
        <button
          onClick={onContinueShopping}
          className="px-6 py-2.5 bg-[#1A3A5C] text-white rounded-full font-semibold hover:bg-[#142d47]"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="space-y-4">
        {items.map((item) => {
          const unavailable = item.availability === "OUT_OF_STOCK" || item.availability === "PRODUCT_UNAVAILABLE" || item.availability === "VARIANT_UNAVAILABLE";
          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 border rounded-lg p-4 bg-white ${unavailable ? "opacity-60" : ""}`}
            >
              {item.image && (
                <img src={item.image} alt={item.productName} className="w-20 h-20 object-cover rounded" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.productName}</h3>
                <p className="text-gray-500 text-sm">{item.variantLabel}</p>
                <p className="text-gray-600">₹{item.unitPrice}</p>
                {item.priceChanged && (
                  <p className="text-xs text-amber-600 mt-1">Price has changed since you added this</p>
                )}
                {item.availability === "INSUFFICIENT_STOCK" && (
                  <p className="text-xs font-semibold text-amber-600 mt-1">Only {item.maxAvailable} available</p>
                )}
                {AVAILABILITY_LABEL[item.availability] && (
                  <p className="text-xs font-semibold text-red-600 mt-1">{AVAILABILITY_LABEL[item.availability]}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={unavailable}
                  aria-label="Decrease quantity"
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  -
                </button>
                <span className="w-8 text-center" aria-live="polite">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={unavailable || item.quantity >= item.maxAvailable}
                  aria-label="Increase quantity"
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <p className="font-semibold">₹{item.lineSubtotal}</p>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-lg font-bold mb-4">
          <span>Subtotal:</span>
          <span>₹{summary.subtotal.toFixed(2)}</span>
        </div>
        {hasUnavailableItems && (
          <p className="text-sm text-amber-600 mb-4">
            Some items in your cart are unavailable or have limited stock — resolve them before checkout.
          </p>
        )}
        <div className="flex gap-4">
          <button
            onClick={clearCart}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            Clear Cart
          </button>
          <button
            onClick={() => onCheckout(items, summary.total)}
            disabled={hasUnavailableItems}
            className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
