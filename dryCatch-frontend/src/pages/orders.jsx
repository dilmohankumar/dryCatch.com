import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ordersAPI } from "../utils/api";

// Business lifecycle (Order.status) — distinct from paymentStatus/
// fulfillmentStatus, see docs/orders.md. Kept here so both the list and
// detail pages present the same vocabulary.
export const STATUS_LABELS = {
  pending_payment: "Pending Payment",
  payment_processing: "Payment Processing",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return Requested",
  returned: "Returned",
  refunded: "Refunded",
};

export const STATUS_COLORS = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  payment_processing: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  packed: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  out_for_delivery: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  return_requested: "bg-orange-100 text-orange-800",
  returned: "bg-orange-100 text-orange-800",
  refunded: "bg-gray-200 text-gray-800",
};

export const PAYMENT_STATUS_LABELS = {
  pending: "Payment Pending",
  processing: "Payment Processing",
  succeeded: "Payment Succeeded",
  failed: "Payment Failed",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function statusColor(status) {
  return STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await ordersAPI.getMyOrders({ page, limit: PAGE_SIZE, status, search });
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleStatusChange = (e) => {
    setPage(1);
    setStatus(e.target.value);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order number (e.g. DC-2026-000123)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg text-sm hover:opacity-90"
          >
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={handleStatusChange}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="p-8 text-center">Loading orders...</div>}
      {!loading && error && <div className="p-8 text-red-600">Error: {error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="p-8 text-center text-gray-500">No orders found</div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="bg-white rounded-lg p-4 border cursor-pointer hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">Order #{order.orderNumber}</h3>
                    <p className="text-gray-600 text-sm">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">
                      {order.itemCount} item(s){order.firstItemName ? ` — ${order.firstItemName}` : ""}
                      {order.itemCount > 1 ? " and more" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`inline-block px-3 py-1 rounded text-sm ${statusColor(order.status)}`}>
                      {statusLabel(order.status)}
                    </p>
                    <p className="font-semibold mt-2">
                      {order.currency === "INR" || !order.currency ? "₹" : order.currency + " "}
                      {order.totalAmount}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} orders)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
