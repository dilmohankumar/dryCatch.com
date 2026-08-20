import Order from "../models/Order.js";
import Fulfillment from "../models/Fulfillment.js";
import FulfillmentItem from "../models/FulfillmentItem.js";
import { assertValidFulfillmentTransition } from "../utils/fulfillmentStateMachine.js";
import { recordOrderEvent } from "./orderEventService.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Note on inventory: by the time an order reaches Fulfillment, its stock
// was already RESERVED (Phase 5, at order creation) and COMMITTED (Phase 8,
// on payment success) — this phase's "allocation" is about assigning
// already-committed stock to a specific fulfillment record for tracking
// purposes (rule #29), not a second inventory deduction. Calling
// inventoryService again here would double-count.

// POST /admin/fulfillments — { orderId, warehouseId?, items? }. `items`
// defaults to the full order (one Fulfillment covering everything); an
// admin can call this more than once with disjoint item subsets to split
// an order across warehouses/fulfillments (rule #28).
export async function createFulfillment({ orderId, warehouseId, items }) {
  const order = await Order.findById(orderId);
  if (!order) fail("Order not found", "ORDER_NOT_FOUND", 404);
  if (order.paymentStatus !== "succeeded") {
    fail("Cannot fulfill an order whose payment hasn't succeeded", "ORDER_NOT_PAYABLE_FOR_FULFILLMENT", 400);
  }

  const sourceItems = items?.length
    ? order.items.filter((i) => items.some((sel) => String(sel.variant) === String(i.variant)))
    : order.items;
  if (!sourceItems.length) fail("No matching order items to fulfill", "NO_FULFILLMENT_ITEMS", 400);

  const fulfillment = await Fulfillment.create({ order: order._id, warehouse: warehouseId, status: "pending" });
  await FulfillmentItem.insertMany(
    sourceItems.map((i) => ({
      fulfillment: fulfillment._id,
      product: i.product,
      variant: i.variant,
      sku: i.sku,
      name: i.name,
      quantity: items?.length ? items.find((sel) => String(sel.variant) === String(i.variant))?.quantity ?? i.quantity : i.quantity,
    }))
  );

  await recordOrderEvent(order._id, {
    type: "FULFILLMENT_CREATED", actorType: "ADMIN",
    message: `Fulfillment created${warehouseId ? " for warehouse" : ""}`,
    metadata: { fulfillmentId: String(fulfillment._id) },
  });

  return fulfillment;
}

async function transition(fulfillmentId, toStatus, actorId) {
  const fulfillment = await Fulfillment.findById(fulfillmentId);
  if (!fulfillment) fail("Fulfillment not found", "FULFILLMENT_NOT_FOUND", 404);
  assertValidFulfillmentTransition(fulfillment.status, toStatus);
  const fromStatus = fulfillment.status;
  fulfillment.status = toStatus;
  await fulfillment.save();
  await recordOrderEvent(fulfillment.order, {
    type: "FULFILLMENT_STATUS_CHANGED", fromStatus, toStatus, actorType: "ADMIN", actorId,
    metadata: { fulfillmentId: String(fulfillment._id) },
  });
  return fulfillment;
}

export const allocate = (id, actorId) => transition(id, "allocated", actorId);
export const startPicking = (id, actorId) => transition(id, "picking", actorId);
export const startPacking = (id, actorId) => transition(id, "packing", actorId);
export const markReadyToShip = (id, actorId) => transition(id, "ready_to_ship", actorId);
// "shipped"/"completed" are driven by shipmentService (creating/delivering
// a shipment against this fulfillment), not called directly by an admin —
// exported for that internal use, not exposed as its own HTTP endpoint.
export const markShipped = (id) => transition(id, "shipped", null);
export const markCompleted = (id) => transition(id, "completed", null);

export async function getFulfillment(fulfillmentId) {
  const fulfillment = await Fulfillment.findById(fulfillmentId).populate("warehouse");
  if (!fulfillment) fail("Fulfillment not found", "FULFILLMENT_NOT_FOUND", 404);
  const items = await FulfillmentItem.find({ fulfillment: fulfillment._id });
  return { fulfillment, items };
}

export async function listFulfillments({ status, warehouseId, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (warehouseId) filter.warehouse = warehouseId;
  const [fulfillments, total] = await Promise.all([
    Fulfillment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("order", "orderNumber user").populate("warehouse", "name code"),
    Fulfillment.countDocuments(filter),
  ]);
  return { fulfillments, page, limit, total, totalPages: Math.ceil(total / limit) };
}
