import { useState, useEffect, useCallback } from "react";
import { reviewAPI } from "../../utils/api.js";
import RatingSummary from "./RatingSummary.jsx";
import ReviewCard from "./ReviewCard.jsx";
import ReviewForm from "./ReviewForm.jsx";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "highest_rating", label: "Highest Rating" },
  { value: "lowest_rating", label: "Lowest Rating" },
  { value: "most_helpful", label: "Most Helpful" },
];

const PAGE_SIZE = 10;

export default function ProductReviews({ productId, user }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [entries, setEntries] = useState([]); // [{review, media}]
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [sort, setSort] = useState("newest");
  const [ratingFilter, setRatingFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [hasPhotos, setHasPhotos] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formNotice, setFormNotice] = useState("");

  const loadSummary = useCallback(() => {
    if (!productId) return;
    setSummaryLoading(true);
    reviewAPI
      .getSummary(productId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [productId]);

  const loadReviews = useCallback(() => {
    if (!productId) return;
    setListLoading(true);
    setListError("");
    reviewAPI
      .getByProduct(productId, {
        sort,
        rating: ratingFilter || undefined,
        verifiedOnly: verifiedOnly || undefined,
        hasPhotos: hasPhotos || undefined,
        page,
        limit: PAGE_SIZE,
      })
      .then((data) => {
        setEntries(data.reviews || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      })
      .catch((err) => setListError(err.message || "Unable to load reviews."))
      .finally(() => setListLoading(false));
  }, [productId, sort, ratingFilter, verifiedOnly, hasPhotos, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Any filter/sort change resets pagination back to page 1.
  useEffect(() => {
    setPage(1);
  }, [sort, ratingFilter, verifiedOnly, hasPhotos]);

  const handleSubmitted = () => {
    setShowForm(false);
    setFormNotice("Thanks — your review has been submitted.");
    loadSummary();
    loadReviews();
    setTimeout(() => setFormNotice(""), 5000);
  };

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Customer Reviews</h2>

      <RatingSummary summary={summary} loading={summaryLoading} />

      <div className="mt-6">
        {user ? (
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] font-semibold"
            >
              Write a Review
            </button>
          ) : (
            <ReviewForm productId={productId} onCancel={() => setShowForm(false)} onSubmitted={handleSubmitted} />
          )
        ) : (
          <p className="text-sm text-gray-500">
            <a href="/login" className="text-[#1A3A5C] font-semibold hover:underline">Log in</a> to write a review.
          </p>
        )}
        {formNotice && <p className="text-sm text-green-700 mt-2">{formNotice}</p>}
      </div>

      {/* Sort + filters */}
      <div className="flex flex-wrap items-center gap-3 mt-8 mb-4">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>{r} stars</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          Verified purchases only
        </label>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={hasPhotos} onChange={(e) => setHasPhotos(e.target.checked)} />
          With photos
        </label>
      </div>

      {/* List */}
      {listLoading && <p className="text-gray-400 text-sm">Loading reviews…</p>}
      {listError && <p className="text-red-600 text-sm">{listError}</p>}

      {!listLoading && !listError && entries.length === 0 && (
        <p className="text-gray-500 text-sm">No reviews match these filters yet.</p>
      )}

      <div className="space-y-4">
        {entries.map(({ review, media }) => (
          <ReviewCard key={review._id} review={review} media={media} currentUserId={user?._id || user?.id} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-500">Page {page} of {totalPages} ({total} reviews)</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
