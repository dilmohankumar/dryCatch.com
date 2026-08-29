import { useEffect, useState } from "react";
import { cmsRedirectAPI } from "../../../utils/api.js";
import { friendlyError } from "./cmsAdminUtils.js";

const EMPTY_FORM = { source: "", destination: "", type: "301" };

export default function CMSRedirectsPage() {
  const [redirects, setRedirects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    cmsRedirectAPI
      .getAll()
      .then((res) => setRedirects(res.redirects || []))
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
      await cmsRedirectAPI.create(form);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      // Surfaces REDIRECT_LOOP / REDIRECT_SOURCE_TAKEN clearly, not just a generic message.
      setSubmitError(err?.code ? `${err.code}: ${err.message}` : friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete redirect "${r.source} → ${r.destination}"?`)) return;
    setBusyId(r._id);
    try {
      await cmsRedirectAPI.delete(r._id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Redirects</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-start">
        <input required placeholder="/source-path" value={form.source} onChange={handleChange("source")}
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        <input required placeholder="/destination-path" value={form.destination} onChange={handleChange("destination")}
          className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30" />
        <select value={form.type} onChange={handleChange("type")}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30">
          <option value="301">301 (permanent)</option>
          <option value="302">302 (temporary)</option>
        </select>
        <button type="submit" disabled={submitting}
          className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50">
          {submitting ? "Saving…" : "Add Redirect"}
        </button>
        {submitError && <p className="text-sm text-red-500 w-full">{submitError}</p>}
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : redirects.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No redirects yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Destination</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {redirects.map((r) => (
                <tr key={r._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-800">{r.source}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.destination}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.type || "301"}</td>
                  <td className="px-4 py-2.5">
                    <button disabled={busyId === r._id} onClick={() => handleDelete(r)}
                      className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">Delete</button>
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
