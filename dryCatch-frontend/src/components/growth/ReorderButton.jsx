import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { growthAPI } from "../../utils/api.js";

// Phase 24 — "Buy Again". Always previews first: the backend re-validates
// every line item's current price/stock, which can easily have changed
// since the order shipped, so the customer sees what's actually available
// before anything is added to their cart (never a silent partial add).
export default function ReorderButton({ orderId }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null); // null = not opened, array = loaded
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const openPreview = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await growthAPI.getReorderPreview(orderId);
      setPreview(data.items || []);
    } catch (err) {
      setError(err.message || "Unable to check availability for these items.");
    } finally {
      setLoading(false);
    }
  };

  const confirmReorder = async () => {
    setAdding(true);
    setError("");
    try {
      await growthAPI.reorder(orderId);
      navigate("/cart");
    } catch (err) {
      setError(err.message || "Unable to add these items to your cart.");
      setAdding(false);
    }
  };

  if (preview === null) {
    return (
      <div>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button
          onClick={openPreview}
          disabled={loading}
          className="w-full px-4 py-2 border-2 border-[#1A3A5C] text-[#1A3A5C] rounded-lg font-semibold hover:bg-[#EAF1FA] disabled:opacity-50"
        >
          {loading ? "Checking availability..." : "Buy Again"}
        </button>
      </div>
    );
  }

  const availableCount = preview.filter((p) => p.available).length;

  return (
    <div className="border rounded-lg p-4 mt-2">
      <h4 className="font-semibold mb-2">Reorder these items?</h4>
      <div className="space-y-1.5 mb-3">
        {preview.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className={item.available ? "text-gray-700" : "text-gray-400 line-through"}>{item.name}</span>
            {!item.available && <span className="text-xs text-red-500">{item.reason || "Unavailable"}</span>}
          </div>
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {availableCount === 0 ? (
        <p className="text-sm text-gray-500">None of these items are currently available.</p>
      ) : (
        <button
          onClick={confirmReorder}
          disabled={adding}
          className="w-full px-4 py-2 bg-[#1A3A5C] text-white rounded-lg font-semibold hover:bg-[#132a44] disabled:opacity-50"
        >
          {adding ? "Adding to cart..." : `Add ${availableCount} available item${availableCount === 1 ? "" : "s"} to cart`}
        </button>
      )}
      <button onClick={() => setPreview(null)} className="w-full text-xs text-gray-400 mt-2 hover:underline">
        Cancel
      </button>
    </div>
  );
}
