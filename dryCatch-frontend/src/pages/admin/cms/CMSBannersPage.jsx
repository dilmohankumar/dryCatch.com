import { useEffect, useState } from "react";
import { cmsBannerAPI } from "../../../utils/api.js";
import { friendlyError } from "./cmsAdminUtils.js";

const EMPTY_FORM = { title: "", link: "", cta: "", target: "homepage", startDate: "", endDate: "" };

export default function CMSBannersPage() {
  const [banners, setBanners] = useState([]);
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
    cmsBannerAPI
      .getAll()
      .then((res) => setBanners(res.banners || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (b) => {
    setEditingId(b._id);
    setForm({
      title: b.title || "",
      link: b.link || "",
      cta: b.cta || "",
      target: b.target || "homepage",
      startDate: b.startDate ? b.startDate.slice(0, 10) : "",
      endDate: b.endDate ? b.endDate.slice(0, 10) : "",
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (editingId) await cmsBannerAPI.update(editingId, form);
      else await cmsBannerAPI.create(form);
      cancelEdit();
      load();
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    setBusyId(b._id);
    try {
      await cmsBannerAPI.delete(b._id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Banners</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required placeholder="Title" value={form.title} onChange={handleChange("title")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30 sm:col-span-2" />
        <input placeholder="Link URL" value={form.link} onChange={handleChange("link")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        <input placeholder="CTA label" value={form.cta} onChange={handleChange("cta")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        <input placeholder="Target (e.g. homepage)" value={form.target} onChange={handleChange("target")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        <div className="flex gap-2">
          <input type="date" value={form.startDate} onChange={handleChange("startDate")}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
          <input type="date" value={form.endDate} onChange={handleChange("endDate")}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        </div>
        {submitError && <p className="text-sm text-red-500 sm:col-span-2">{submitError}</p>}
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" disabled={submitting}
            className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50">
            {submitting ? "Saving…" : editingId ? "Update Banner" : "Add Banner"}
          </button>
          {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-gray-500 hover:underline">Cancel</button>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : banners.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No banners yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Impressions</th>
                <th className="px-4 py-2.5 font-medium">Clicks</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.map((b) => (
                <tr key={b._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{b.title}</td>
                  <td className="px-4 py-2.5 text-gray-500">{b.target || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500">{b.impressions ?? 0}</td>
                  <td className="px-4 py-2.5 text-gray-500">{b.clicks ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(b)} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                      <button disabled={busyId === b._id} onClick={() => handleDelete(b)}
                        className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">Delete</button>
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
