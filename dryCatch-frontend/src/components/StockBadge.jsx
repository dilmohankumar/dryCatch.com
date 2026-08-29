// Customer-facing stock state — deliberately just three states, no exact
// quantities (the backend never sends them here either; see variantsAPI.getAvailability).
const LABELS = {
  in_stock: { text: "✓ In Stock", className: "text-green-700 bg-green-50" },
  low_stock: { text: "⚠ Low Stock", className: "text-amber-700 bg-amber-50" },
  out_of_stock: { text: "Out of Stock", className: "text-gray-500 bg-gray-100" },
};

export default function StockBadge({ status, className = "" }) {
  const info = LABELS[status];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${info.className} ${className}`}>
      {info.text}
    </span>
  );
}
