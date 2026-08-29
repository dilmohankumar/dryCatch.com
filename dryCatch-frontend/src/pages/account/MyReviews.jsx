import { useState, useEffect } from "react";
import { reviewAPI } from "../../utils/api";
import StarRating, { StarRatingInput } from "../../components/reviews/StarRating.jsx";

const STATUS_LABEL = {
  pending: { label: "Pending moderation", cls: "bg-amber-50 text-amber-700" },
  published: { label: "Published", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700" },
  hidden: { label: "Hidden", cls: "bg-gray-100 text-gray-500" },
};

const TITLE_MAX = 120;
const BODY_MAX = 5000;

export default function MyReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 5, title: "", body: "" });
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { reviews } = await reviewAPI.getMyReviews();
      setReviews(reviews || []);
    } catch (err) {
      setError(err.message || "Unable to load your reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (review) => {
    setEditingId(review._id);
    setEditForm({ rating: review.rating, title: review.title || "", body: review.body || "" });
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError("");
  };

  const saveEdit = async (id) => {
    setSaving(true);
    setSaveError("");
    try {
      const { review } = await reviewAPI.update(id, editForm);
      setReviews((prev) => prev.map((r) => (r._id === id ? review : r)));
      setEditingId(null);
    } catch (err) {
      setSaveError(err.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this review? This can't be undone.")) return;
    try {
      await reviewAPI.delete(id);
      setReviews((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      setError(err.message || "Unable to delete this review.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading your reviews...</div>;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">My Reviews</h2>
        <p className="text-sm text-gray-500">Reviews you've written, including any still pending moderation</p>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {reviews.length === 0 ? (
        <p className="text-gray-500">You haven't written any reviews yet.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const status = STATUS_LABEL[review.status] || { label: review.status, cls: "bg-gray-100 text-gray-500" };
            const isEditing = editingId === review._id;
            return (
              <div key={review._id} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{review.product?.name || "Product"}</p>
                    <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-3">
                    <StarRatingInput value={editForm.rating} onChange={(rating) => setEditForm((f) => ({ ...f, rating }))} />
                    <div>
                      <input
                        value={editForm.title}
                        maxLength={TITLE_MAX}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Title"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1 text-right">{editForm.title.length}/{TITLE_MAX}</p>
                    </div>
                    <div>
                      <textarea
                        value={editForm.body}
                        maxLength={BODY_MAX}
                        onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                        placeholder="Your review"
                        className="w-full border rounded-lg px-3 py-2 text-sm min-h-24"
                      />
                      <p className="text-xs text-gray-400 mt-1 text-right">{editForm.body.length}/{BODY_MAX}</p>
                    </div>
                    {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(review._id)}
                        disabled={saving}
                        className="px-4 py-1.5 bg-[#1A3A5C] text-white text-sm rounded-lg hover:bg-[#142d47] disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} className="px-4 py-1.5 border text-sm rounded-lg hover:bg-white">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-2"><StarRating rating={review.rating} /></div>
                    {review.title && <p className="font-medium mt-2">{review.title}</p>}
                    {review.body && <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{review.body}</p>}
                    <div className="flex gap-3 mt-3 text-sm">
                      <button onClick={() => startEdit(review)} className="text-[#1A3A5C] hover:underline">Edit</button>
                      <button onClick={() => handleDelete(review._id)} className="text-red-600 hover:underline">Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
