import { useEffect, useState } from "react";
import { rolesAPI } from "../../utils/api.js";

function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    rolesAPI
      .getAll()
      .then((res) => {
        if (!cancelled) setRoles(res.roles || []);
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
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Roles</h1>
      <p className="text-sm text-gray-500 mb-6">
        System roles (seeded defaults) can't be edited or deleted here — the backend blocks that too.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : roles.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No roles found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role._id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{role.name}</td>
                  <td className="px-4 py-3 text-gray-600">{role.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs rounded-full px-2 py-0.5 ${
                        role.isSystem ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {role.isSystem ? "System" : "Custom"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {role.name === "SUPER_ADMIN" ? (
                      <span className="text-xs text-gray-500 italic">All permissions (implicit)</span>
                    ) : (
                      <>
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => setExpanded(expanded === role._id ? null : role._id)}
                        >
                          {(role.permissions || []).length} permission
                          {(role.permissions || []).length === 1 ? "" : "s"} ·{" "}
                          {expanded === role._id ? "hide" : "show"}
                        </button>
                        {expanded === role._id && (
                          <div className="mt-2 flex flex-wrap gap-1 max-w-xl">
                            {(role.permissions || []).map((p) => (
                              <span
                                key={p}
                                className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-600 font-mono"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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
