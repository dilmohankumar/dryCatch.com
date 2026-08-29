import { useEffect, useState } from "react";
import { cmsMediaAPI } from "../../../utils/api.js";
import { friendlyError } from "./cmsAdminUtils.js";

const EMPTY_FORM = { filename: "", type: "image", url: "", mimeType: "image/jpeg", size: "", altText: "" };

// No real file upload exists server-side (docs/cms.md's honest-stub gap) —
// this registers a media record by URL, matching POST /admin/cms/media's
// actual contract exactly.
export default function CMSMediaPage() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    cmsMediaAPI
      .getAll()
      .then((res) => setMedia(res.media || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await cmsMediaAPI.upload({ ...form, size: form.size ? Number(form.size) : undefined });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.filename}"?`)) return;
    setBusyId(item._id);
    try {
      await cmsMediaAPI.delete(item._id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Media Library</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="Filename"
          value={form.filename}
          onChange={handleChange("filename")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <select
          value={form.type}
          onChange={handleChange("type")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
        </select>
        <input
          required
          placeholder="URL"
          value={form.url}
          onChange={handleChange("url")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <input
          placeholder="MIME type (e.g. image/jpeg)"
          value={form.mimeType}
          onChange={handleChange("mimeType")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <input
          type="number"
          placeholder="Size (bytes)"
          value={form.size}
          onChange={handleChange("size")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <input
          placeholder="Alt text"
          value={form.altText}
          onChange={handleChange("altText")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        {submitError && <p className="text-sm text-red-500 sm:col-span-2">{submitError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50 sm:col-span-2 sm:w-fit"
        >
          {submitting ? "Registering…" : "Register Media"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : media.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No media yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Preview</th>
                <th className="px-4 py-2.5 font-medium">Filename</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {media.map((m) => (
                <tr key={m._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    {m.type === "image" && m.url ? (
                      <img src={m.url} alt={m.altText || ""} className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                        {m.type}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{m.filename}</td>
                  <td className="px-4 py-2.5 text-gray-500">{m.type}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">{m.status || "ready"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      disabled={busyId === m._id}
                      onClick={() => handleDelete(m)}
                      className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
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
