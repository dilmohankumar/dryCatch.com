import { useEffect, useState } from "react";
import { growthAPI } from "../../utils/api.js";

// Phase 24 — subscribes a signed-in customer to a back-in-stock
// notification for the exact variant they were looking at. Only rendered
// while the variant is genuinely out of stock; the toggle state is derived
// from the user's own subscription list rather than assumed, so refreshing
// the page or coming back later shows the true current state.
export default function StockAlertButton({ productId, variantId, user, onToast }) {
  const [subscription, setSubscription] = useState(null); // null = unknown/unsubscribed, object = subscribed
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !variantId) return;
    let cancelled = false;
    growthAPI
      .listStockAlerts()
      .then(({ alerts }) => {
        if (cancelled) return;
        const existing = (alerts || []).find((a) => a.variant === variantId && a.type === "back_in_stock");
        setSubscription(existing || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, variantId]);

  if (!user) {
    return (
      <p className="text-sm text-gray-500">
        <a href="/login" className="text-[#1A3A5C] font-semibold underline">Sign in</a> to get notified when this is back in stock.
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscription) {
        await growthAPI.unsubscribeStockAlert(subscription._id);
        setSubscription(null);
        onToast?.({ type: "success", message: "You won't be notified for this item anymore" });
      } else {
        const created = await growthAPI.subscribeStockAlert({ productId, variantId, type: "back_in_stock" });
        setSubscription(created);
        onToast?.({ type: "success", message: "We'll email you when this is back in stock" });
      }
    } catch {
      onToast?.({ type: "error", message: "Couldn't update your notification preference" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full py-3 rounded-2xl font-bold text-sm sm:text-base border-2 transition-all
        ${subscription ? "border-green-500 text-green-600 bg-green-50" : "border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EAF1FA]"}`}
    >
      {subscription ? "✓ We'll notify you when it's back" : "🔔 Notify me when back in stock"}
    </button>
  );
}
