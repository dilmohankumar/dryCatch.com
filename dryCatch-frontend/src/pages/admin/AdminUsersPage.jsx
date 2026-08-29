import { useEffect, useState } from "react";
import { adminUsersAPI, rolesAPI } from "../../utils/api.js";

function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteStatus, setInviteStatus] = useState(null); // { type: "success"|"error", message }
  const [inviting, setInviting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([adminUsersAPI.getAll(), rolesAPI.getAll()])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes.users || []);
        setRoles(rolesRes.roles || []);
        if (!inviteRoleId && rolesRes.roles?.length) setInviteRoleId(rolesRes.roles[0]._id);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteRoleId) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      await adminUsersAPI.invite({ email: inviteEmail, roleId: inviteRoleId });
      setInviteStatus({
        type: "success",
        message: "Invite created — no email integration yet, so check the server logs for the accept link.",
      });
      setInviteEmail("");
      load();
    } catch (err) {
      setInviteStatus({ type: "error", message: friendlyError(err) });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Users</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Invite Admin</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
            />
          </div>
          <div className="sm:w-56">
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3A5C]/30"
            >
              {roles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteRoleId}
            className="bg-[#1A3A5C] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#142d47] transition disabled:opacity-50"
          >
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
        {inviteStatus && (
          <p className={`text-xs mt-2 ${inviteStatus.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {inviteStatus.message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No admin users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u._id || i} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.adminRole?.name || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        u.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
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
