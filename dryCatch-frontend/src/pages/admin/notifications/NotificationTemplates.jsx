import { useEffect, useState } from "react";
import { adminNotificationsAPI } from "../../../utils/api.js";
import { friendlyError } from "./notificationAdminUtils.js";

const EMPTY_FORM = { type: "", channel: "email", name: "", subject: "", body: "", variables: "" };
const EVENT_TYPE_OPTIONS = [
  "ORDER_CREATED", "ORDER_CONFIRMED", "ORDER_CANCELLED", "PAYMENT_SUCCESSFUL", "PAYMENT_FAILED",
  "REFUND_CREATED", "REFUND_COMPLETED", "ORDER_SHIPPED", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED",
  "REVIEW_APPROVED", "REVIEW_REJECTED", "BACK_IN_STOCK", "USER_REGISTERED",
];

export default function NotificationTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminNotificationsAPI
      .listTemplates()
      .then((res) => setTemplates(res.templates || []))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (t) => {
    setEditingId(t._id);
    setForm({ type: t.type, channel: t.channel, name: t.name, subject: t.subject || "", body: t.body, variables: (t.variables || []).join(", ") });
    setPreview(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    const payload = {
      type: form.type,
      channel: form.channel,
      name: form.name,
      subject: form.subject || undefined,
      body: form.body,
      variables: form.variables.split(",").map((v) => v.trim()).filter(Boolean),
    };
    try {
      if (editingId) await adminNotificationsAPI.updateTemplate(editingId, payload);
      else await adminNotificationsAPI.createTemplate(payload);
      cancelEdit();
      load();
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id) => {
    setBusyId(id);
    try {
      await adminNotificationsAPI.publishTemplate(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (t) => {
    const sampleData = {};
    (t.variables || []).forEach((v) => { sampleData[v] = `[${v}]`; });
    try {
      const res = await adminNotificationsAPI.previewTemplate(t._id, sampleData);
      setPreview({ id: t._id, ...res });
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const handleTestSend = async (t) => {
    try {
      await adminNotificationsAPI.sendTest({ eventType: t.type, channel: t.channel });
      alert("Test notification sent to your admin account (console-logged in this environment).");
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notification Templates</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex gap-3">
          <select required value={form.type} onChange={handleChange("type")} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled={!!editingId}>
            <option value="">Event type…</option>
            {EVENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={form.channel} onChange={handleChange("channel")} className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled={!!editingId}>
            {["email", "sms", "push", "in_app", "web_push", "whatsapp"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input required placeholder="Template name" value={form.name} onChange={handleChange("name")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Subject (email only) — e.g. Hi {{customerName}}" value={form.subject} onChange={handleChange("subject")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <textarea required rows={3} placeholder="Body — e.g. Your order {{orderNumber}} has shipped." value={form.body} onChange={handleChange("body")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Declared variables, comma-separated — e.g. customerName, orderNumber" value={form.variables} onChange={handleChange("variables")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <p className="text-xs text-gray-400">
          Only variables listed here may be used in subject/body — any other {"{{variable}}"} is rejected before save.
        </p>
        {submitError && <p className="text-sm text-red-500">{submitError}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50">
            {submitting ? "Saving…" : editingId ? "Update Template" : "Create Template"}
          </button>
          {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-gray-500 hover:underline">Cancel</button>}
        </div>
      </form>

      {preview && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm">
          {preview.subject && <p className="font-semibold mb-1">Subject: {preview.subject}</p>}
          <p className="whitespace-pre-wrap">{preview.body}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-500 text-center py-10">{error}</div>
        ) : templates.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No templates yet — built-in default copy is used until one is published.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type / Channel</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{t.type} / {t.channel}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === "published" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">v{t.version}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button onClick={() => startEdit(t)} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handlePreview(t)} className="text-xs font-medium text-gray-600 hover:underline">Preview</button>
                      <button onClick={() => handleTestSend(t)} className="text-xs font-medium text-purple-600 hover:underline">Test Send</button>
                      {t.status !== "published" && (
                        <button disabled={busyId === t._id} onClick={() => handlePublish(t._id)} className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50">Publish</button>
                      )}
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
