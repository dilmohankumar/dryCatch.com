import { useEffect, useState } from "react";
import { dashboardAPI } from "../../utils/api.js";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

function money(v) {
  const n = Number(v) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function Growth({ value }) {
  const n = Number(value) || 0;
  const positive = n >= 0;
  return (
    <span className={`text-xs font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? "▲" : "▼"} {Math.abs(n).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, growth, format }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{format ? format(value) : value}</div>
      {growth !== undefined && growth !== null && (
        <div className="mt-1">
          <Growth value={growth} /> <span className="text-xs text-gray-400">vs previous period</span>
        </div>
      )}
    </div>
  );
}

// A generic loading/error/content wrapper so one slow or failed section
// never blocks the rest of the page (docs/admin.md's rule #151/#154).
function Section({ title, loading, error, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">{title}</h2>
      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-500 py-6 text-center">{error}</div>
      ) : (
        children
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    dashboardAPI
      .get(range)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [range]);

  const kpis = data?.kpis || {};
  const revenueBreakdown = data?.revenueBreakdown || {};
  const lowStock = data?.lowStock || [];
  const topProducts = data?.topProducts || [];
  const recentOrders = data?.recentOrders || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                range === r.key ? "bg-[#1A3A5C] text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && !loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-red-500">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-24 animate-pulse" />
              ))
            ) : (
              <>
                <KpiCard label="Revenue" value={kpis.revenue?.value} growth={kpis.revenue?.growth} format={money} />
                <KpiCard label="Orders" value={kpis.orders?.value} growth={kpis.orders?.growth} />
                <KpiCard
                  label="New Customers"
                  value={kpis.newCustomers?.value}
                  growth={kpis.newCustomers?.growth}
                />
                <KpiCard
                  label="Avg Order Value"
                  value={kpis.averageOrderValue?.value}
                  growth={kpis.averageOrderValue?.growth}
                  format={money}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Section title="Revenue Breakdown" loading={loading} error={null}>
              <dl className="text-sm space-y-1.5">
                {[
                  ["Gross Sales", revenueBreakdown.grossSales],
                  ["Discounts", revenueBreakdown.discounts],
                  ["Shipping", revenueBreakdown.shipping],
                  ["Tax", revenueBreakdown.tax],
                  ["Net Revenue", revenueBreakdown.netRevenue],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-800">{money(value)}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="Products by Status" loading={loading} error={null}>
              <dl className="text-sm space-y-1.5">
                {Object.entries(data?.products?.byStatus || {}).length === 0 ? (
                  <div className="text-gray-400 text-center py-6">No data</div>
                ) : (
                  Object.entries(data?.products?.byStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between">
                      <dt className="text-gray-500 capitalize">{status}</dt>
                      <dd className="font-medium text-gray-800">{count}</dd>
                    </div>
                  ))
                )}
              </dl>
            </Section>

            <Section title="At a Glance" loading={loading} error={null}>
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Pending Reviews</dt>
                  <dd className="font-medium text-gray-800">{data?.pendingReviewCount ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Search Zero-Result Rate</dt>
                  <dd className="font-medium text-gray-800">
                    {data?.search?.zeroResultRate !== undefined
                      ? `${Number(data.search.zeroResultRate).toFixed(1)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {data?.search?.topQueries?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-1">Top Queries</div>
                  <div className="flex flex-wrap gap-1">
                    {data.search.topQueries.slice(0, 8).map((q, i) => (
                      <span key={i} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-600">
                        {typeof q === "string" ? q : q.query}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Section title="Low Stock" loading={loading} error={null}>
              {lowStock.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6">Nothing low on stock.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 font-medium text-right">Available</th>
                      <th className="pb-2 font-medium text-right">Reorder Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-800">{item.sku}</td>
                        <td className="py-1.5 text-right text-red-600 font-medium">{item.available}</td>
                        <td className="py-1.5 text-right text-gray-500">{item.reorderLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Top Products" loading={loading} error={null}>
              {topProducts.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6">No sales in this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium">Product</th>
                      <th className="pb-2 font-medium text-right">Units</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p._id} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-800">{p.name}</td>
                        <td className="py-1.5 text-right text-gray-600">{p.unitsSold}</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">{money(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Recent Orders" loading={loading} error={null}>
              {recentOrders.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6">No recent orders.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium">Order</th>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-800">{o.orderNumber}</td>
                        <td className="py-1.5 text-gray-600">
                          {o.user ? `${o.user.firstName || ""} ${o.user.lastName || ""}`.trim() : "—"}
                        </td>
                        <td className="py-1.5 text-right font-medium text-gray-800">{money(o.totalAmount)}</td>
                        <td className="py-1.5">
                          <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-600">
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Recent Activity" loading={loading} error={null}>
              {recentActivity.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6">No recent admin activity.</div>
              ) : (
                <ul className="space-y-2">
                  {recentActivity.map((a, i) => (
                    <li key={i} className="text-sm flex justify-between gap-2">
                      <span className="text-gray-700">
                        <span className="font-medium">
                          {a.actor ? `${a.actor.firstName || ""} ${a.actor.lastName || ""}`.trim() : "System"}
                        </span>{" "}
                        <span className="text-gray-500">{a.action}</span>
                        {a.entityType ? <span className="text-gray-400"> · {a.entityType}</span> : null}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
