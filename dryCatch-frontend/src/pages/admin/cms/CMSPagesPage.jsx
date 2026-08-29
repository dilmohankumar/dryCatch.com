import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cmsPagesAPI } from "../../../utils/api.js";
import { friendlyError, STATUS_STYLES, STATUS_LABELS, actionsForStatus, ACTION_LABELS } from "./cmsAdminUtils.js";

export default function CMSPagesPage() {
  const [pages, setPages] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    cmsPagesAPI
      .getAll(status ? { status } : {})
      .then((res) => setPages(res.pages || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const runAction = async (page, action) => {
    setBusyId(page._id);
    setActionError(null);
    try {
      if (action === "schedule") {
        const when = window.prompt("Schedule for (ISO date/time, e.g. 2026-09-01T09:00):");
        if (!when) return;
        await cmsPagesAPI.schedule(page._id, when);
      } else {
        await cmsPagesAPI[action](page._id);
      }
      load();
    } catch (err) {
      if (err?.code === "PUBLISH_VALIDATION_FAILED" && Array.isArray(err.issues)) {
        setActionError(
          `Publish failed: ${err.issues.map((i) => i.message || i.code).join("; ")}`
        );
      } else {
        setActionError(friendlyError(err));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CMS Pages</h1>
        <Link
          to="/admin/cms/pages/new"
          className="bg-[#1A3A5C] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#142d47] transition"
        >
          New Page
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {actionError && <p className="text-sm text-red-500 mb-3">{actionError}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : pages.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No pages found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Slug</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <Link to={`/admin/cms/pages/${p._id}`} className="hover:underline">
                      {p.title || "(untitled)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{p.slug}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.pageType || "static"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLES[p.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      {actionsForStatus(p.status).map((action) => (
                        <button
                          key={action}
                          disabled={busyId === p._id}
                          onClick={() => runAction(p, action)}
                          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {ACTION_LABELS[action]}
                        </button>
                      ))}
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
