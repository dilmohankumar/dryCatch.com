import StarRating from "./StarRating.jsx";

// Fed by GET /products/:productId/reviews/summary — { averageRating,
// reviewCount, ratingDistribution: {1..5}, verifiedReviewCount, photoReviewCount }.
// The backend is the sole authority on these numbers (docs/reviews.md); this
// component only renders what it's given.
export default function RatingSummary({ summary, loading }) {
  if (loading) {
    return <div className="p-4 text-sm text-gray-400">Loading rating summary…</div>;
  }
  if (!summary || !summary.reviewCount) {
    return (
      <div className="p-4 sm:p-5 bg-gray-50 rounded-xl">
        <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this product!</p>
      </div>
    );
  }

  const { averageRating, reviewCount, ratingDistribution = {}, verifiedReviewCount, photoReviewCount } = summary;
  const maxBucket = Math.max(1, ...[1, 2, 3, 4, 5].map((r) => ratingDistribution[r] || 0));

  return (
    <div className="p-4 sm:p-5 bg-gray-50 rounded-xl grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 sm:gap-8">
      {/* Average */}
      <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1">
        <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">{averageRating.toFixed(1)}</div>
        <div>
          <StarRating rating={averageRating} size="md" />
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Distribution bars */}
      <div className="flex flex-col gap-1.5 min-w-0">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = ratingDistribution[star] || 0;
          const pct = Math.round((count / maxBucket) * 100);
          return (
            <div key={star} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="w-10 flex-shrink-0 text-gray-500 tabular-nums">{star} star</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 flex-shrink-0 text-right text-gray-500 tabular-nums">{count}</span>
            </div>
          );
        })}
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          {verifiedReviewCount > 0 && <span>✓ {verifiedReviewCount} verified purchase{verifiedReviewCount === 1 ? "" : "s"}</span>}
          {photoReviewCount > 0 && <span>📷 {photoReviewCount} with photos</span>}
        </div>
      </div>
    </div>
  );
}
