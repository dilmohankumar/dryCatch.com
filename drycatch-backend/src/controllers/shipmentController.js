import Order from "../models/Order.js";
import * as shipmentService from "../services/shipmentService.js";
import { toShipmentSummaryDTO, toShipmentTrackingDTO } from "../utils/shipmentDTO.js";

async function assertOwnsShipmentOrder(shipment, user) {
  if (!shipment) return false;
  if (user.role === "admin") return true;
  const order = await Order.findById(shipment.order);
  return order && String(order.user) === String(user._id);
}

// GET /orders/:orderId/shipments — customer, ownership-checked via the
// order (IDOR — rule #68). An order with no shipments yet returns an empty
// list, not an error — "not shipped yet" is a normal state, not a failure.
export async function getOrderShipments(req, res) {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (String(order.user) !== String(req.user._id) && req.user.role !== "admin") {
    return res.status(403).json({ message: "Not authorized to view this order's shipments" });
  }
  const shipments = await shipmentService.getShipmentsForOrder(order._id);
  res.json({ shipments: shipments.map(toShipmentSummaryDTO) });
}

// GET /shipments/:id — customer (own order only) or admin.
export async function getShipment(req, res) {
  const { shipment } = await shipmentService.getShipmentTracking(req.params.id);
  if (!(await assertOwnsShipmentOrder(shipment, req.user))) {
    return res.status(403).json({ message: "Not authorized to view this shipment" });
  }
  res.json({ shipment: toShipmentSummaryDTO(shipment) });
}

// GET /shipments/:id/tracking — full event history, same ownership rule.
export async function getShipmentTracking(req, res) {
  const { shipment, events } = await shipmentService.getShipmentTracking(req.params.id);
  if (!(await assertOwnsShipmentOrder(shipment, req.user))) {
    return res.status(403).json({ message: "Not authorized to view this shipment" });
  }
  res.json(toShipmentTrackingDTO(shipment, events));
}

// ---- Admin ----

export async function postCreateShipment(req, res) {
  const { fulfillmentId, carrier, shippingMethod } = req.body;
  const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
  const result = await shipmentService.createShipment({ fulfillmentId, carrierName: carrier, shippingMethod, idempotencyKey });
  res.status(201).json({ shipment: result.shipment, reused: Boolean(result.reused) });
}

export async function postGenerateLabel(req, res) {
  const shipment = await shipmentService.generateLabel(req.params.id);
  res.json({ shipment });
}

export async function postCancelShipment(req, res) {
  const shipment = await shipmentService.cancelShipment(req.params.id);
  res.json({ shipment });
}

export async function postPollShipment(req, res) {
  const shipment = await shipmentService.pollShipmentStatus(req.params.id);
  res.json({ shipment });
}

export async function listShipmentsAdmin(req, res) {
  const { status, page, limit } = req.query;
  const result = await shipmentService.listShipmentsAdmin({ status, page: Number(page) || 1, limit: Number(limit) || 50 });
  res.json(result);
}
