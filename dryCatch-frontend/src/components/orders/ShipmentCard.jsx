import { useState } from "react";
import { shipmentAPI } from "../../utils/api";
import { shipmentStatusLabel, shipmentStatusColor } from "./shipmentStatus.js";
import ShipmentTracking from "./ShipmentTracking.jsx";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : null;
}

// One physical package. An order can have several of these (partial
// fulfillment) — each renders as its own card with its own expandable
// timeline, never merged with another shipment's events.
export default function ShipmentCard({ shipment, index }) {
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !tracking) {
      try {
        setLoadingTracking(true);
        setTrackingError("");
        const data = await shipmentAPI.getShipmentTracking(shipment.id);
        setTracking(data);
      } catch (err) {
        setTrackingError(err.message || "Unable to load tracking details.");
      } finally {
        setLoadingTracking(false);
      }
    }
  };

  const eta = shipment.estimatedDelivery;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
        <div>
          <p className="font-semibold">
            Shipment {index + 1}
            {shipment.carrier ? ` — ${shipment.carrier}` : ""}
          </p>
          {shipment.trackingNumber && (
            <p className="text-sm text-gray-600">
              Tracking #:{" "}
              {shipment.trackingUrl ? (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1A3A5C] hover:underline"
                >
                  {shipment.trackingNumber}
                </a>
              ) : (
                shipment.trackingNumber
              )}
            </p>
          )}
        </div>
        <span className={`font-semibold text-sm px-3 py-1 rounded ${shipmentStatusColor(shipment.status)}`}>
          {shipmentStatusLabel(shipment.status)}
        </span>
      </div>

      {shipment.shippingMethod && (
        <p className="text-sm text-gray-600 mb-1">Method: {shipment.shippingMethod}</p>
      )}

      {eta && (eta.from || eta.to) && (
        <p className="text-sm text-gray-600 mb-1">
          Estimated delivery: {formatDate(eta.from)}
          {eta.to ? ` – ${formatDate(eta.to)}` : ""}
        </p>
      )}

      {shipment.deliveredAt && (
        <p className="text-sm text-gray-600 mb-1">Delivered on {formatDate(shipment.deliveredAt)}</p>
      )}
      {!shipment.deliveredAt && shipment.shippedAt && (
        <p className="text-sm text-gray-600 mb-1">Shipped on {formatDate(shipment.shippedAt)}</p>
      )}

      <button
        onClick={toggleExpanded}
        className="mt-2 text-sm text-[#1A3A5C] hover:underline"
      >
        {expanded ? "Hide tracking details ▲" : "View tracking details ▼"}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {loadingTracking && <p className="text-gray-500 text-sm">Loading tracking...</p>}
          {trackingError && <p className="text-red-600 text-sm">{trackingError}</p>}
          {tracking && <ShipmentTracking events={tracking.events} />}
        </div>
      )}
    </div>
  );
}
