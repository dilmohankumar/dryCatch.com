import Order from "../models/Order.js";
import Shipment from "../models/Shipment.js";
import { recordOrderEvent } from "./orderEventService.js";

const SHIPPED_OR_LATER = ["picked_up", "in_transit", "out_for_delivery", "delivered"];

// Recomputes Order.fulfillmentStatus (and, where safe, Order.status) from
// the current state of ALL shipments across ALL fulfillments belonging to
// the order — never set directly from a single shipment's webhook event
// (rule #87: "do not directly set order status without checking the
// complete order state"). This deliberately writes `order.status` directly
// rather than through orderStateMachine's admin-facing transition graph —
// same documented bypass as Phase 9's refund handling, because a shipment
// event is a SYSTEM fact arriving asynchronously, not a single-step admin
// action, and needs to be able to jump straight to "delivered" from
// whatever the order's current status happens to be.
export async function syncOrderFulfillmentState(orderId) {
  const order = await Order.findById(orderId);
  if (!order) return null;

  const shipments = await Shipment.find({ order: orderId });
  if (!shipments.length) return order;

  const allDelivered = shipments.every((s) => s.status === "delivered");
  const anyDelivered = shipments.some((s) => s.status === "delivered");
  const allShippedOrLater = shipments.every((s) => SHIPPED_OR_LATER.includes(s.status));
  const anyShippedOrLater = shipments.some((s) => SHIPPED_OR_LATER.includes(s.status));

  let newFulfillmentStatus;
  if (allDelivered) newFulfillmentStatus = "delivered";
  else if (anyDelivered) newFulfillmentStatus = "partially_delivered";
  else if (allShippedOrLater) newFulfillmentStatus = "shipped";
  else if (anyShippedOrLater) newFulfillmentStatus = "partially_shipped";
  else newFulfillmentStatus = order.fulfillmentStatus; // no change yet — still processing/packed

  if (newFulfillmentStatus === order.fulfillmentStatus) return order;

  const fromFulfillmentStatus = order.fulfillmentStatus;
  const fromStatus = order.status;
  order.fulfillmentStatus = newFulfillmentStatus;

  // Only fully-delivered (single unambiguous outcome across every shipment)
  // is reflected onto the coarser Order.status — partial states stay
  // expressed only in fulfillmentStatus, since Order.status's own enum
  // (Phase 9) has no "partially_shipped" equivalent and shouldn't gain one
  // just to mirror this finer-grained field.
  if (newFulfillmentStatus === "delivered" && !["delivered", "cancelled", "refunded"].includes(order.status)) {
    order.status = "delivered";
  }
  await order.save();

  await recordOrderEvent(order._id, {
    type: "ORDER_FULFILLMENT_SYNCED",
    fromStatus: fromFulfillmentStatus,
    toStatus: newFulfillmentStatus,
    actorType: "SYSTEM",
    message: `Fulfillment status recomputed from ${shipments.length} shipment(s)`,
  });
  if (order.status !== fromStatus) {
    await recordOrderEvent(order._id, {
      type: "ORDER_STATUS_CHANGED", fromStatus, toStatus: order.status, actorType: "SYSTEM",
      message: "All shipments delivered",
    });
  }

  return order;
}
