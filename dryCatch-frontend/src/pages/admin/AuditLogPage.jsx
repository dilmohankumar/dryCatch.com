import { useEffect, useState } from "react";
import { auditLogAPI } from "../../utils/api.js";

function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const [filters, setFilters] = useState({ action: "", entityType: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    auditLogAPI
      .getAll({ page, limit: 20, ...filters })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.logs || []);
        setTotalPages(res.totalPages || 1);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.action, filters.entityType]);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    setFilters({ ...filters });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>

      <form onSubmit={applyFilters} className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Action (e.g. PRODUCT_UPDATED)"
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <input
          type="text"
          placeholder="Entity type (e.g. Product)"
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <button
          type="submit"
          className="bg-[#1A3A5C] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#142d47] transition"
        >
          Filter
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No audit entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Entity</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const key = log._id || i;
                return (
                  <tr key={key} className="border-b border-gray-50 last:border-0 align-top">
                    <td className="px-4 py-2.5 text-gray-800 whitespace-nowrap">
                      {log.actor ? `${log.actor.firstName || ""} ${log.actor.lastName || ""}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{log.action}</td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {log.entityType}
                      {log.entityId ? <span className="text-gray-400"> #{String(log.entityId).slice(-6)}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setExpanded(expanded === key ? null : key)}
                      >
                        {expanded === key ? "hide" : "view"}
                      </button>
                      {expanded === key && (
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Before</div>
                            <pre className="bg-gray-50 rounded-lg p-2 text-xs overflow-auto max-h-48">
                              {JSON.stringify(log.before ?? null, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">After</div>
                            <pre className="bg-gray-50 rounded-lg p-2 text-xs overflow-auto max-h-48">
                              {JSON.stringify(log.after ?? null, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && logs.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
