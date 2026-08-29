// Renders one shipment's full tracking history (GET /shipments/:id/tracking
// events, ascending time order) as a vertical timeline. Deliberately scoped
// to a single shipment — an order can have multiple shipments (partial
// fulfillment), and each one's history must render as its own distinct
// timeline rather than being merged with another package's events.
import { SHIPMENT_STATUS_LABELS } from "./shipmentStatus.js";

function eventStatusLabel(status) {
  return SHIPMENT_STATUS_LABELS[status] || status;
}

export default function ShipmentTracking({ events }) {
  if (!events || events.length === 0) {
    return <p className="text-gray-500 text-sm">No tracking updates yet.</p>;
  }

  // Show most recent first for readability, without mutating the
  // ascending-order array the backend returned.
  const ordered = [...events].reverse();

  return (
    <ol className="relative border-l-2 border-gray-200 ml-2">
      {ordered.map((event, idx) => (
        <li key={idx} className="mb-6 ml-4 last:mb-0">
          <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-[#1A3A5C] mt-1.5" />
          <p className="font-semibold">{eventStatusLabel(event.status)}</p>
          {event.location && <p className="text-gray-600 text-sm">{event.location}</p>}
          {event.description && <p className="text-gray-600 text-sm">{event.description}</p>}
          {event.eventTime && (
            <p className="text-gray-400 text-xs mt-0.5">
              {new Date(event.eventTime).toLocaleString()}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
