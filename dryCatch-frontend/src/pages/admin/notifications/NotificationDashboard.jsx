import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminNotificationsAPI } from "../../../utils/api.js";
import { friendlyError } from "./notificationAdminUtils.js";

// Overview (rule #146) — queue health, dead-letter count, recent admin
// notifications, and a manual trigger for the lazy retry/event-recovery
// passes (this project has no real background worker — documented
// throughout Phase 16 — so these are admin-triggered, same as CMS's
// scheduled-publish check).
export default function NotificationDashboard() {
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([adminNotificationsAPI.getQueueHealth(), adminNotificationsAPI.list({ limit: 10 })])
      .then(([h, a]) => {
        setHealth(h);
        setAlerts(a.items || []);
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const runRetries = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await adminNotificationsAPI.processRetries();
      setMessage(`Processed ${res.processed.length} retrying deliveries.`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const runReprocess = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await adminNotificationsAPI.reprocessEvents();
      setMessage(`Reprocessed ${res.processed.length} pending events.`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-400 text-center py-10">Loading…</div>;
  if (error) return <div className="text-sm text-red-500 text-center py-10">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Notifications</h1>
      <p className="text-sm text-gray-500 mb-6">
        No background worker/queue infrastructure exists in this project — retries and pending-event
        recovery run lazily, triggered here rather than by a real scheduler.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          ["Pending", health?.pending],
          ["Processing", health?.processing],
          ["Retrying", health?.retrying],
          ["Dead Letter", health?.dlq],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          disabled={busy}
          onClick={runRetries}
          className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50"
        >
          Process Due Retries
        </button>
        <button
          disabled={busy}
          onClick={runReprocess}
          className="bg-white border border-gray-300 text-gray-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Reprocess Pending Events
        </button>
        <Link to="/admin/notifications/dead-letter" className="text-sm text-blue-600 font-medium self-center hover:underline">
          View Dead Letter Queue →
        </Link>
        <Link to="/admin/notifications/deliveries" className="text-sm text-blue-600 font-medium self-center hover:underline">
          View Delivery Logs →
        </Link>
      </div>
      {message && <p className="text-sm text-green-600 mb-6">{message}</p>}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Admin Alerts</h2>
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {alerts.length === 0 && <div className="text-sm text-gray-400 text-center py-8">No admin alerts yet.</div>}
        {alerts.map((a) => (
          <div key={a._id} className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{a.title}</p>
            <p className="text-xs text-gray-500">{a.body}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
