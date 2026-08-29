import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ordersAPI, shipmentAPI } from "../utils/api";
import { statusLabel, statusColor, PAYMENT_STATUS_LABELS } from "./orders.jsx";
import OrderTimeline from "../components/orders/OrderTimeline.jsx";
import ShipmentCard from "../components/orders/ShipmentCard.jsx";
import ReorderButton from "../components/growth/ReorderButton.jsx";

// Only these Order.status values are customer-cancellable server-side
// (utils/cancellationPolicy.js#canCustomerCancel) — mirrored here purely
// for UI gating; the server is still the authority when the button is
// actually clicked (a status may have changed since page load).
const CANCELLABLE_STATUSES = ["pending_payment", "payment_processing", "confirmed", "processing"];

function currencySymbol(currency) {
  return !currency || currency === "INR" ? "₹" : `${currency} `;
}

function AddressBlock({ title, address }) {
  if (!address) return null;
  return (
    <div>
      <h4 className="font-semibold mb-2">{title}</h4>
      <p className="text-gray-600 text-sm">
        {address.fullName && (
          <>
            {address.fullName}
            <br />
          </>
        )}
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}
        <br />
        {address.city}, {address.state} {address.pincode}
        {address.country ? `, ${address.country}` : ""}
        {address.phone && (
          <>
            <br />
            {address.phone}
          </>
        )}
      </p>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [shipments, setShipments] = useState(null);
  const [shipmentsError, setShipmentsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [orderData, timelineData, shipmentsData] = await Promise.all([
        ordersAPI.getById(id),
        ordersAPI.getOrderTimeline(id).catch(() => null),
        shipmentAPI
          .getOrderShipments(id)
          .catch((err) => {
            setShipmentsError(err.message || "Unable to load shipments.");
            return null;
          }),
      ]);
      setOrder(orderData.order);
      setTimeline(timelineData);
      setShipments(shipmentsData?.shipments ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleCancel = async () => {
    if (!confirm("Cancel this order?")) return;
    try {
      setCancelling(true);
      setCancelError("");
      const data = await ordersAPI.cancel(id);
      setOrder(data.order);
      loadOrder();
    } catch (err) {
      setCancelError(err.message || "Unable to cancel this order.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading order...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!order) return <div className="p-8 text-center text-gray-500">Order not found</div>;

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const symbol = currencySymbol(order.currency);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => navigate("/orders")}
        className="mb-4 text-[#1A3A5C] hover:underline"
      >
        ← Back to Orders
      </button>

      <div className="bg-white rounded-lg p-6 border mb-6">
        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
          <h2 className="text-2xl font-bold">Order #{order.orderNumber}</h2>
          <span className={`font-semibold px-3 py-1 rounded ${statusColor(order.status)}`}>
            {statusLabel(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-gray-600 text-sm">Order Date</p>
            <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Payment Status</p>
            <p className="font-semibold">
              {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
            </p>
          </div>
          {order.shippingMethod && (
            <div>
              <p className="text-gray-600 text-sm">Shipping Method</p>
              <p className="font-semibold">{order.shippingMethod}</p>
            </div>
          )}
        </div>

        <h3 className="text-lg font-semibold mb-3">Items</h3>
        <div className="space-y-2 mb-6">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between border-b pb-2">
              <span>
                {item.name || "Product"}
                {item.variantLabel ? ` (${item.variantLabel})` : ""}
              </span>
              <span className="text-right">
                {symbol}
                {item.price} × {item.quantity} = {symbol}
                {item.lineTotal}
                {item.discountAmount > 0 && (
                  <span className="block text-xs text-green-700">
                    includes -{symbol}
                    {item.discountAmount} discount
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 mb-6 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>
              {symbol}
              {order.subtotal}
            </span>
          </div>
          {order.shippingCost != null && (
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>
                {symbol}
                {order.shippingCost}
              </span>
            </div>
          )}
          {order.taxAmount != null && (
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>
                {symbol}
                {order.taxAmount}
              </span>
            </div>
          )}
          {/* Named per-promotion breakdown when available — falls back to
              a single generic line for orders placed before this existed. */}
          {order.promotions?.length
            ? order.promotions.map((p, idx) => (
                p.discountAmount > 0 && (
                  <div key={idx} className="flex justify-between text-gray-600">
                    <span>{p.name}{order.couponCode && idx === 0 ? ` (${order.couponCode})` : ""}</span>
                    <span>
                      -{symbol}
                      {p.discountAmount}
                    </span>
                  </div>
                )
              ))
            : order.discountAmount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>
                    -{symbol}
                    {order.discountAmount}
                  </span>
                </div>
              )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span>
              {symbol}
              {order.totalAmount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <AddressBlock title="Shipping Address" address={order.shippingAddress} />
          <AddressBlock title="Billing Address" address={order.billingAddress} />
        </div>

        {cancelError && <p className="text-red-600 text-sm mb-3">{cancelError}</p>}

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>
        )}

        <div className="mt-3">
          <ReorderButton orderId={order._id || order.id} />
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border mb-6">
        <h3 className="text-lg font-semibold mb-4">Shipments</h3>
        {shipmentsError && <p className="text-red-600 text-sm">{shipmentsError}</p>}
        {!shipmentsError && shipments && shipments.length === 0 && (
          <p className="text-gray-500 text-sm">Not shipped yet.</p>
        )}
        {shipments && shipments.length > 0 && (
          <div className="space-y-4">
            {shipments.map((shipment, idx) => (
              <ShipmentCard key={shipment.id} shipment={shipment} index={idx} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-6 border">
        <h3 className="text-lg font-semibold mb-4">Order Timeline</h3>
        <OrderTimeline events={timeline?.events} />
      </div>
    </div>
  );
}
