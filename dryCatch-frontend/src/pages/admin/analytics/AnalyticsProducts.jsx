import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import DateRangePicker from "../../../components/analytics/DateRangePicker.jsx";
import DataTable from "../../../components/analytics/DataTable.jsx";
import { friendlyError, DEFAULT_RANGE } from "./analyticsAdminUtils.js";

export default function AnalyticsProducts() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [sortBy, setSortBy] = useState("revenue");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([adminAnalyticsAPI.products({ ...range, sortBy, limit: 50 }), adminAnalyticsAPI.categories({ ...range, limit: 20 })])
      .then(([p, c]) => { setProducts(p.data); setCategories(c.data); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [range, sortBy]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products & Categories</h1>
        <div className="flex items-center gap-3">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="revenue">Sort by Revenue</option>
            <option value="units">Sort by Units</option>
            <option value="views">Sort by Views</option>
            <option value="orders">Sort by Orders</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400 text-center py-10">Loading…</div>}
      {error && <div className="text-sm text-red-500 text-center py-10">{error}</div>}

      {!loading && !error && (
        <>
          <h2 className="font-semibold text-gray-900 mb-3">Top Products</h2>
          <DataTable
            columns={[
              { key: "name", label: "Product", sortable: true },
              { key: "views", label: "Views", sortable: true },
              { key: "addToCart", label: "Add to Cart", sortable: true },
              { key: "purchases", label: "Orders", sortable: true },
              { key: "unitsSold", label: "Units", sortable: true },
              { key: "revenue", label: "Revenue", sortable: true, render: (r) => `₹${r.revenue.toLocaleString("en-IN")}` },
              { key: "conversionRate", label: "Conversion", render: (r) => `${(r.conversionRate * 100).toFixed(1)}%` },
            ]}
            rows={products}
            getRowKey={(r) => r.productId}
            emptyMessage="No product activity in this period"
          />

          <h2 className="font-semibold text-gray-900 mb-3 mt-8">Top Categories</h2>
          <DataTable
            columns={[
              { key: "name", label: "Category", sortable: true },
              { key: "orders", label: "Orders", sortable: true },
              { key: "units", label: "Units", sortable: true },
              { key: "revenue", label: "Revenue", sortable: true, render: (r) => `₹${r.revenue.toLocaleString("en-IN")}` },
              { key: "revenueSharePercent", label: "Revenue Share", render: (r) => `${(r.revenueSharePercent * 100).toFixed(1)}%` },
            ]}
            rows={categories}
            getRowKey={(r) => r.categoryId}
            emptyMessage="No category activity in this period"
          />
        </>
      )}
    </div>
  );
}
