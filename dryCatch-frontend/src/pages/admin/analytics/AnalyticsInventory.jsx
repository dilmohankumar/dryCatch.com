import { useEffect, useState } from "react";
import { adminAnalyticsAPI } from "../../../utils/api.js";
import MetricCard from "../../../components/analytics/MetricCard.jsx";
import DataTable from "../../../components/analytics/DataTable.jsx";
import { friendlyError } from "./analyticsAdminUtils.js";

export default function AnalyticsInventory() {
  const [data, setData] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([adminAnalyticsAPI.inventory(), adminAnalyticsAPI.lowStock({ limit: 50 })])
      .then(([i, l]) => { setData(i); setLowStock(l.data); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-gray-400 text-center py-10">Loading…</div>;
  if (error) return <div className="text-sm text-red-500 text-center py-10">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Inventory</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Units in Stock" value={data.summary.unitsInStock} />
        <MetricCard label="Stock Value (at selling price)" value={data.summary.stockValueAtSellingPrice} format="currency" />
        <MetricCard label="Low Stock" value={data.summary.lowStockCount} inverse />
        <MetricCard label="Out of Stock" value={data.summary.outOfStockCount} inverse />
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Inventory turnover is not shown — {data.turnover.reason}
      </p>

      <h2 className="font-semibold text-gray-900 mb-3">Low Stock / Out of Stock</h2>
      <DataTable
        columns={[
          { key: "productName", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "available", label: "Available", sortable: true },
          { key: "reorderLevel", label: "Reorder Level" },
        ]}
        rows={lowStock}
        emptyMessage="Nothing low on stock"
      />
    </div>
  );
}
