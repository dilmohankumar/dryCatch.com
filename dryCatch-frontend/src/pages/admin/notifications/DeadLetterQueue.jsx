import { useEffect, useState } from "react";
import { adminNotificationsAPI } from "../../../utils/api.js";
import { friendlyError } from "./notificationAdminUtils.js";

// Admin can inspect/retry/cancel exhausted deliveries (rule #53).
export default function DeadLetterQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminNotificationsAPI
      .listDeadLetter({ limit: 50 })
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const retry = async (id) => {
    setBusyId(id);
    try {
      await adminNotificationsAPI.retryDeadLetter(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (id) => {
    setBusyId(id);
    try {
      await adminNotificationsAPI.cancelDeadLetter(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dead Letter Queue</h1>
      <p className="text-sm text-gray-500 mb-6">Deliveries that exhausted their retry budget. Inspect, retry, or cancel.</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">Nothing in the dead letter queue.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Notification</th>
                <th className="px-4 py-2.5 font-medium">Channel</th>
                <th className="px-4 py-2.5 font-medium">Error</th>
                <th className="px-4 py-2.5 font-medium">Failed At</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{d.notification?.title || d.notification?.eventType || "—"}</td>
                  <td className="px-4 py-2.5 capitalize">{d.channel.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-red-500 text-xs">{d.errorMessage} ({d.errorClass})</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.failedAt ? new Date(d.failedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button disabled={busyId === d._id} onClick={() => retry(d._id)} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">Retry</button>
                      <button disabled={busyId === d._id} onClick={() => cancel(d._id)} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">Cancel</button>
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
