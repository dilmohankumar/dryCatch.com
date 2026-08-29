export default function ReviewSummaryBlock({ data = {} }) {
  const product = data.product;
  if (!product || !product.name) return null;

  const rating = Number(product.rating) || 0;

  return (
    <section className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}>★</span>
        ))}
      </div>
      <span className="text-sm text-gray-700 font-semibold">{product.name}</span>
      <span className="text-xs text-gray-400">
        {rating.toFixed(1)} ({product.reviewsCount || 0} reviews)
      </span>
    </section>
  );
}
