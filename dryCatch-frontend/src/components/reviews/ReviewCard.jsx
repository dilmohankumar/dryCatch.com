import { useState } from "react";
import StarRating from "./StarRating.jsx";
import { reviewAPI } from "../../utils/api.js";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "offensive", label: "Offensive content" },
  { value: "fake_review", label: "Fake review" },
  { value: "irrelevant", label: "Irrelevant to product" },
  { value: "abusive", label: "Abusive" },
  { value: "other", label: "Other" },
];

// Renders only the first name + last-initial, e.g. "Dilmohan K." — the
// backend populates the reviewer's full name, but the product page should
// not over-expose a customer's identity (rule referenced in the task brief).
function reviewerLabel(user) {
  if (!user) return "Anonymous";
  const first = user.firstName || "Anonymous";
  const lastInitial = user.lastName ? `${user.lastName[0].toUpperCase()}.` : "";
  return lastInitial ? `${first} ${lastInitial}` : first;
}

export default function ReviewCard({ review, media = [], currentUserId, onVoteChange }) {
  const [voteState, setVoteState] = useState({
    helpfulCount: review.helpfulCount || 0,
    notHelpfulCount: review.notHelpfulCount || 0,
  });
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDescription, setReportDescription] = useState("");
  const [reportStatus, setReportStatus] = useState(null); // null | "sending" | "sent" | "already" | "error"

  const isOwnReview = currentUserId && review.user?._id === currentUserId;

  const castVote = async (vote) => {
    if (voting || isOwnReview) return;
    setVoting(true);
    setVoteError("");
    try {
      const { review: updated } = await reviewAPI.vote(review._id, vote);
      setVoteState({ helpfulCount: updated.helpfulCount, notHelpfulCount: updated.notHelpfulCount });
      onVoteChange?.(updated);
    } catch (err) {
      if (err.code === "REVIEW_NOT_OWNER") {
        setVoteError("You can't vote on your own review.");
      } else if (err.code === "REVIEW_NOT_PUBLISHED") {
        setVoteError("This review isn't available for voting.");
      } else {
        setVoteError(err.message || "Unable to record your vote.");
      }
    } finally {
      setVoting(false);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    setReportStatus("sending");
    try {
      await reviewAPI.report(review._id, {
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportStatus("sent");
    } catch (err) {
      if (err.code === "REVIEW_ALREADY_REPORTED") {
        setReportStatus("already");
      } else {
        setReportStatus("error");
      }
    }
  };

  return (
    <div className="p-4 sm:p-5 border border-gray-100 rounded-xl">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900">{reviewerLabel(review.user)}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StarRating rating={review.rating} />
            {review.isVerifiedPurchase && (
              <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                ✓ Verified Purchase
              </span>
            )}
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-400 flex-shrink-0">
          {new Date(review.createdAt).toLocaleDateString()}
        </p>
      </div>

      {review.variantNameSnapshot && (
        <p className="text-xs text-gray-400 mt-2">Purchased: {review.variantNameSnapshot}</p>
      )}

      {review.title && <p className="font-semibold text-gray-900 mt-3">{review.title}</p>}
      {review.body && <p className="text-gray-600 text-sm sm:text-base mt-1 whitespace-pre-wrap">{review.body}</p>}

      {media.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {media.map((m, i) =>
            m.type === "video" ? (
              <video key={i} src={m.url} controls className="w-20 h-20 rounded-lg object-cover bg-black" />
            ) : (
              <img key={i} src={m.url} alt="" className="w-20 h-20 rounded-lg object-cover" />
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 flex-wrap text-sm">
        {!isOwnReview ? (
          <>
            <button
              onClick={() => castVote("helpful")}
              disabled={voting}
              className="flex items-center gap-1.5 text-gray-500 hover:text-[#1A3A5C] transition-colors disabled:opacity-50"
            >
              👍 Helpful ({voteState.helpfulCount})
            </button>
            <button
              onClick={() => castVote("not_helpful")}
              disabled={voting}
              className="flex items-center gap-1.5 text-gray-500 hover:text-[#1A3A5C] transition-colors disabled:opacity-50"
            >
              👎 Not helpful ({voteState.notHelpfulCount})
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">
            {voteState.helpfulCount} found this helpful
          </span>
        )}

        {!isOwnReview && (
          <button
            onClick={() => setShowReport((v) => !v)}
            className="text-gray-400 hover:text-red-500 transition-colors ml-auto"
          >
            Report
          </button>
        )}
      </div>

      {voteError && <p className="text-xs text-red-500 mt-2">{voteError}</p>}

      {showReport && !isOwnReview && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          {reportStatus === "sent" ? (
            <p className="text-sm text-green-700">Thanks — this review has been reported for moderation.</p>
          ) : reportStatus === "already" ? (
            <p className="text-sm text-gray-500">You've already reported this review.</p>
          ) : (
            <form onSubmit={submitReport} className="space-y-2">
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Additional details (optional)"
                className="w-full border rounded-lg px-3 py-1.5 text-sm min-h-16"
              />
              {reportStatus === "error" && <p className="text-xs text-red-500">Unable to submit your report. Please try again.</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={reportStatus === "sending"}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {reportStatus === "sending" ? "Submitting…" : "Submit report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReport(false)}
                  className="px-3 py-1.5 border text-xs font-semibold rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
