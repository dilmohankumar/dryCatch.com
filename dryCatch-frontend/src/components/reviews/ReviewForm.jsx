import { useState } from "react";
import { StarRatingInput } from "./StarRating.jsx";
import { reviewAPI } from "../../utils/api.js";

const TITLE_MAX = 120;
const BODY_MAX = 5000;

// Write-a-review form. Eligibility (has the customer bought this product?)
// is never pre-checked client-side — the backend is the sole source of
// truth (docs/reviews.md); REVIEW_NOT_ELIGIBLE / ALREADY_REVIEWED /
// INVALID_RATING just surface as plain error text from a real submit attempt.
export default function ReviewForm({ productId, onCancel, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { rating, title: title.trim(), body: body.trim() };
      if (photoUrl.trim()) {
        payload.media = [{ type: "image", url: photoUrl.trim(), mimeType: "image/jpeg", size: 0 }];
      }
      const result = await reviewAPI.create(productId, payload);
      onSubmitted?.(result);
    } catch (err) {
      if (err.code === "REVIEW_NOT_ELIGIBLE") {
        setError("You can review this product only after purchasing it (a paid order is required).");
      } else if (err.code === "ALREADY_REVIEWED") {
        setError("You've already reviewed this product. Edit your existing review from My Reviews instead.");
      } else if (err.code === "INVALID_RATING") {
        setError("Please choose a valid star rating between 1 and 5.");
      } else {
        setError(err.message || "Unable to submit your review. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-5 bg-[#EAF1FA] rounded-xl space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Your rating</label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div>
        <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          id="review-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum up your experience"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/{TITLE_MAX}</p>
      </div>

      <div>
        <label htmlFor="review-body" className="block text-sm font-medium text-gray-700 mb-1">Review</label>
        <textarea
          id="review-body"
          value={body}
          maxLength={BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your experience with this product…"
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-28"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/{BODY_MAX}</p>
      </div>

      <div>
        <label htmlFor="review-photo" className="block text-sm font-medium text-gray-700 mb-1">
          Photo URL <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="review-photo"
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">No file upload yet — paste a link to an already-hosted image.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50 font-semibold"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-white/50 font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
