import { useEffect, useState } from "react";
import { adminCampaignsAPI, adminNotificationsAPI } from "../../../utils/api.js";
import { friendlyError } from "./notificationAdminUtils.js";

const EMPTY_FORM = { name: "", template: "", channels: ["email"], segment: "all" };

// Campaign create is a separate permission from campaign send (rule #107)
// — the backend enforces this; this UI just calls whichever endpoint the
// admin clicks, and a 403 surfaces via friendlyError if they lack "send".
export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([adminCampaignsAPI.list(), adminNotificationsAPI.listTemplates()])
      .then(([c, t]) => {
        setCampaigns(c.items || []);
        setTemplates((t.templates || []).filter((tpl) => tpl.status === "published"));
      })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await adminCampaignsAPI.create({
        name: form.name,
        template: form.template,
        channels: form.channels,
        audience: { segment: form.segment },
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm("Send this campaign now? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await adminCampaignsAPI.send(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handlePause = async (id) => {
    setBusyId(id);
    try {
      await adminCampaignsAPI.pause(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const viewAnalytics = async (id) => {
    try {
      const res = await adminCampaignsAPI.getAnalytics(id);
      setAnalytics({ id, ...res });
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Campaigns</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <input required placeholder="Campaign name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-3">
          <select required value={form.template} onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Published template…</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.channel})</option>)}
          </select>
          <select value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">All customers</option>
            <option value="new_customers">New customers (30d)</option>
            <option value="inactive">Inactive (90d+)</option>
          </select>
        </div>
        {templates.length === 0 && <p className="text-xs text-amber-600">No published templates yet — publish one from Templates first.</p>}
        {submitError && <p className="text-sm text-red-500">{submitError}</p>}
        <button type="submit" disabled={submitting || templates.length === 0} className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50">
          {submitting ? "Creating…" : "Create Campaign"}
        </button>
      </form>

      {analytics && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[["Recipients", analytics.recipients], ["Sent", analytics.sent], ["Delivered", analytics.delivered], ["Failed", analytics.failed], ["Clicked", analytics.clicked], ["CTR", `${analytics.ctr}%`]].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : campaigns.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No campaigns yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Stats</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">{c.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {c.stats?.sent ?? 0} sent · {c.stats?.failed ?? 0} failed · {c.stats?.unsubscribed ?? 0} skipped
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      {["draft", "scheduled"].includes(c.status) && (
                        <button disabled={busyId === c._id} onClick={() => handleSend(c._id)} className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50">Send Now</button>
                      )}
                      {c.status === "running" && (
                        <button disabled={busyId === c._id} onClick={() => handlePause(c._id)} className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50">Pause</button>
                      )}
                      <button onClick={() => viewAnalytics(c._id)} className="text-xs font-medium text-blue-600 hover:underline">Analytics</button>
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
