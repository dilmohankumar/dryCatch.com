import { useEffect, useState } from "react";
import { cmsFaqAPI } from "../../../utils/api.js";
import { friendlyError } from "./cmsAdminUtils.js";

const EMPTY_FORM = { question: "", answer: "", category: "", order: 0 };

export default function CMSFaqPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    cmsFaqAPI
      .getAll()
      .then((res) => setFaqs(res.faqs || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (faq) => {
    setEditingId(faq._id);
    setForm({ question: faq.question || "", answer: faq.answer || "", category: faq.category || "", order: faq.order ?? 0 });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    const payload = { ...form, order: Number(form.order) || 0 };
    try {
      if (editingId) await cmsFaqAPI.update(editingId, payload);
      else await cmsFaqAPI.create(payload);
      cancelEdit();
      load();
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (faq) => {
    if (!window.confirm(`Delete FAQ "${faq.question}"?`)) return;
    setBusyId(faq._id);
    try {
      await cmsFaqAPI.delete(faq._id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">FAQs</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <input
          required
          placeholder="Question"
          value={form.question}
          onChange={handleChange("question")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <textarea
          required
          placeholder="Answer"
          rows={3}
          value={form.answer}
          onChange={handleChange("answer")}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <div className="flex gap-3">
          <input
            placeholder="Category"
            value={form.category}
            onChange={handleChange("category")}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
          />
          <input
            type="number"
            placeholder="Order"
            value={form.order}
            onChange={handleChange("order")}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
          />
        </div>
        {submitError && <p className="text-sm text-red-500">{submitError}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50"
          >
            {submitting ? "Saving…" : editingId ? "Update FAQ" : "Add FAQ"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="text-sm text-gray-500 hover:underline">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : faqs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No FAQs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Question</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((f) => (
                <tr key={f._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{f.question}</td>
                  <td className="px-4 py-2.5 text-gray-500">{f.category || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">{f.status || "active"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(f)} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                      <button
                        disabled={busyId === f._id}
                        onClick={() => handleDelete(f)}
                        className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
