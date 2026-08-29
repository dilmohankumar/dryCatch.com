import { useEffect, useState } from "react";
import { adminNotificationsAPI } from "../../../utils/api.js";
import { friendlyError, DELIVERY_STATUS_STYLES } from "./notificationAdminUtils.js";

export default function DeliveryLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    adminNotificationsAPI
      .listDeliveries({ status: statusFilter || undefined, channel: channelFilter || undefined, limit: 50 })
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter, channelFilter]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Delivery Logs</h1>

      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {["pending", "queued", "processing", "sent", "delivered", "failed", "bounced", "cancelled", "retrying"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All channels</option>
          {["email", "sms", "push", "in_app", "web_push", "whatsapp"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No deliveries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Notification</th>
                <th className="px-4 py-2.5 font-medium">Channel</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Attempt</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{d.notification?.title || d.notification?.eventType || "—"}</p>
                    <p className="text-xs text-gray-400">{d.notification?.category}</p>
                  </td>
                  <td className="px-4 py-2.5 capitalize">{d.channel.replace("_", " ")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${DELIVERY_STATUS_STYLES[d.status] || "bg-gray-100 text-gray-600"}`}>{d.status}</span>
                    {d.errorMessage && <p className="text-xs text-red-500 mt-0.5">{d.errorMessage}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{d.attempt}/{d.maxAttempts}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.provider || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
