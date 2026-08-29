import { useEffect, useState } from "react";
import { adminCustomersAPI } from "../../utils/api.js";

function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminCustomersAPI
      .getAll({ page, limit: 20, search, status })
      .then((res) => {
        setCustomers(res.customers || []);
        setTotalPages(res.totalPages || 1);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleBlock = async (customer) => {
    const reason = window.prompt(`Reason for blocking ${customer.email}?`);
    if (reason === null) return;
    setBusyId(customer._id);
    setActionError(null);
    try {
      await adminCustomersAPI.block(customer._id, reason);
      load();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblock = async (customer) => {
    setBusyId(customer._id);
    setActionError(null);
    try {
      await adminCustomersAPI.unblock(customer._id);
      load();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customers</h1>

      <form onSubmit={applySearch} className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <button
          type="submit"
          className="bg-[#1A3A5C] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#142d47] transition"
        >
          Search
        </button>
      </form>

      {actionError && <p className="text-sm text-red-500 mb-3">{actionError}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : customers.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No customers found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c._id || i} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.phone || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        c.status === "blocked"
                          ? "bg-red-50 text-red-600"
                          : c.status === "active"
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.status === "blocked" ? (
                      <button
                        disabled={busyId === c._id}
                        onClick={() => handleUnblock(c)}
                        className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        disabled={busyId === c._id}
                        onClick={() => handleBlock(c)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && customers.length > 0 && (
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
