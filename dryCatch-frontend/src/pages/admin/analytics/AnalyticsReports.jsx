import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import { friendlyError } from "./analyticsAdminUtils.js";

const REPORT_TYPES = [
  { value: "daily_sales", label: "Daily Sales" },
  { value: "monthly_sales", label: "Monthly Sales" },
  { value: "product_performance", label: "Product Performance" },
  { value: "customer", label: "Customer Report" },
  { value: "inventory", label: "Inventory Report" },
  { value: "payment", label: "Payment Report" },
  { value: "shipping", label: "Shipping Report" },
  { value: "discount", label: "Discount Report" },
];

// No real scheduler exists (documented throughout this project) — "Run
// Now" is how a report actually gets generated; `schedule` just records
// intent for whenever a real cron gets wired up.
export default function AnalyticsReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", type: "daily_sales", schedule: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState(null);

  const load = () => {
    setLoading(true);
    adminAnalyticsAPI.listReports().then((res) => setReports(res.reports)).catch((err) => setError(friendlyError(err))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminAnalyticsAPI.createReport(form);
      setForm({ name: "", type: "daily_sales", schedule: "none" });
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRun = async (id) => {
    setRunningId(id);
    try {
      await adminAnalyticsAPI.runReport(id);
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <input required placeholder="Report name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="flex gap-3">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="none">On-demand only</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={submitting} className="bg-[#1A3A5C] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#142d47] disabled:opacity-50">
          {submitting ? "Creating…" : "Create Report"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-10">No reports configured yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Schedule</th>
                <th className="px-4 py-2.5 font-medium">Last Run</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.type}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.schedule}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : "Never"}
                    {r.lastStatus === "failed" && <span className="text-red-500 block text-xs">{r.lastError}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <button disabled={runningId === r._id} onClick={() => handleRun(r._id)} className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">
                      {runningId === r._id ? "Running…" : "Run Now"}
                    </button>
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
