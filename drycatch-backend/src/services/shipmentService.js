import Shipment from "../models/Shipment.js";
import ShipmentItem from "../models/ShipmentItem.js";
import ShipmentEvent from "../models/ShipmentEvent.js";
import Fulfillment from "../models/Fulfillment.js";
import FulfillmentItem from "../models/FulfillmentItem.js";
import Order from "../models/Order.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { getCarrier } from "./carriers/carrierFactory.js";
import { assertValidShipmentTransition, isStaleForwardEvent, isOnForwardLine } from "../utils/shipmentStateMachine.js";
import { recordOrderEvent } from "./orderEventService.js";
import * as fulfillmentService from "./fulfillmentService.js";
import { syncOrderFulfillmentState } from "./orderFulfillmentSync.js";
import { logAuditEvent } from "../utils/auditLog.js";
import * as eventBus from "./notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

function assertShippingAddressComplete(order) {
  const required = ["line1", "city", "state", "pincode", "phone"];
  const missing = required.filter((f) => !order.shippingAddress?.[f]);
  if (missing.length) fail(`Order shipping address is incomplete: missing ${missing.join(", ")}`, "INCOMPLETE_SHIPPING_ADDRESS", 400);
}

// POST /admin/shipments — { fulfillmentId, carrierName?, shippingMethod?,
// idempotencyKey? }. Idempotent (rule #94): a repeated identical request
// (same key) returns the shipment already created rather than opening a
// second carrier shipment.
export async function createShipment({ fulfillmentId, carrierName, shippingMethod = "standard", idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await Shipment.findOne({ idempotencyKey });
    if (existing) return { shipment: existing, reused: true };
  }

  const fulfillment = await Fulfillment.findById(fulfillmentId);
  if (!fulfillment) fail("Fulfillment not found", "FULFILLMENT_NOT_FOUND", 404);
  // A shipment can only be created once its fulfillment has actually
  // finished picking/packing (the state machine's natural precondition) —
  // this also guarantees the ready_to_ship -> shipped transition below is
  // always valid, no silent catch-and-hope needed.
  if (fulfillment.status !== "ready_to_ship") {
    fail(`Cannot create a shipment — fulfillment must be "ready_to_ship" (currently "${fulfillment.status}")`, "FULFILLMENT_NOT_SHIPPABLE", 400);
  }

  const order = await Order.findById(fulfillment.order);
  if (!order) fail("Order not found", "ORDER_NOT_FOUND", 404);
  assertShippingAddressComplete(order);

  const fulfillmentItems = await FulfillmentItem.find({ fulfillment: fulfillment._id });
  if (!fulfillmentItems.length) fail("Fulfillment has no items", "NO_FULFILLMENT_ITEMS", 400);

  const carrier = getCarrier(carrierName);
  const rates = await carrier.getRates({ orderValue: order.subtotal });
  const rate = rates.find((r) => r.method === shippingMethod) || rates[0];
  const estimate = await carrier.getEstimatedDelivery({ method: shippingMethod });

  const carrierResult = await carrier.createShipment({
    orderNumber: order.orderNumber,
    shippingAddress: order.shippingAddress,
    items: fulfillmentItems,
    method: shippingMethod,
  });

  const shipment = await Shipment.create({
    order: order._id,
    fulfillment: fulfillment._id,
    warehouse: fulfillment.warehouse,
    carrier: carrier.name,
    carrierShipmentId: carrierResult.carrierShipmentId,
    trackingNumber: carrierResult.trackingNumber,
    trackingUrl: carrierResult.trackingUrl,
    status: "created",
    shippingMethod,
    customerShippingCharge: order.shippingCost,
    carrierShippingCost: rate?.cost,
    estimatedDeliveryFrom: estimate.from,
    estimatedDeliveryTo: estimate.to,
    idempotencyKey,
  });

  await ShipmentItem.insertMany(
    fulfillmentItems.map((fi) => ({
      shipment: shipment._id,
      fulfillmentItem: fi._id,
      variant: fi.variant,
      sku: fi.sku,
      name: fi.name,
      quantity: fi.quantity,
    }))
  );

  await ShipmentEvent.create({
    shipment: shipment._id, status: "created", eventTime: new Date(), source: "system",
    description: "Shipment created",
  });

  await fulfillmentService.markShipped(fulfillment._id);

  await recordOrderEvent(order._id, {
    type: "SHIPMENT_CREATED", actorType: "ADMIN",
    message: `Shipment created via ${carrier.name}`,
    metadata: { shipmentId: String(shipment._id), trackingNumber: shipment.trackingNumber },
  });
  logAuditEvent("SHIPMENT_CREATED", order.user, { shipmentId: String(shipment._id), orderId: String(order._id) });
  await eventBus.publish(EVENT_TYPES.SHIPMENT_CREATED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(order.user), trackingNumber: shipment.trackingNumber }, { source: "shipment" });

  return { shipment, reused: false };
}

// POST /admin/shipments/:id/label — idempotent (rule #95): if a label
// already exists, return it rather than generating (and potentially
// billing for) a second one.
export async function generateLabel(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) fail("Shipment not found", "SHIPMENT_NOT_FOUND", 404);
  if (shipment.labelUrl) return shipment; // already generated — no-op

  const carrier = getCarrier(shipment.carrier);
  try {
    const result = await carrier.generateLabel(shipment.carrierShipmentId);
    shipment.labelUrl = result.labelUrl;
    shipment.labelGeneratedAt = new Date();
    assertValidShipmentTransition(shipment.status, "label_created");
    shipment.status = "label_created";
    await shipment.save();
    await ShipmentEvent.create({ shipment: shipment._id, status: "label_created", eventTime: new Date(), source: "system" });
  } catch (err) {
    shipment.status = "label_failed";
    await shipment.save();
    await ShipmentEvent.create({ shipment: shipment._id, status: "label_failed", eventTime: new Date(), source: "system", description: err.message });
    throw err;
  }
  return shipment;
}

// POST /admin/shipments/:id/cancel — only before the carrier has actually
// picked the parcel up (rule #50: shipment cancellation differs from order
// cancellation, and gets harder/impossible once a courier physically has
// it).
export async function cancelShipment(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) fail("Shipment not found", "SHIPMENT_NOT_FOUND", 404);
  if (!["created", "label_failed", "label_created", "ready_for_pickup"].includes(shipment.status)) {
    fail(`Cannot cancel a shipment already in status "${shipment.status}"`, "SHIPMENT_NOT_CANCELLABLE", 400);
  }
  const carrier = getCarrier(shipment.carrier);
  await carrier.cancelShipment(shipment.carrierShipmentId).catch(() => {});
  shipment.status = "cancelled";
  await shipment.save();
  await ShipmentEvent.create({ shipment: shipment._id, status: "cancelled", eventTime: new Date(), source: "admin" });
  await recordOrderEvent(shipment.order, { type: "SHIPMENT_CANCELLED", actorType: "ADMIN", metadata: { shipmentId: String(shipment._id) } });
  return shipment;
}

// Polling fallback (rule #74) for carriers without reliable webhooks —
// calls the same normalized apply-status path a webhook would, just
// sourced from a direct API call instead of a push event.
export async function pollShipmentStatus(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) fail("Shipment not found", "SHIPMENT_NOT_FOUND", 404);
  const carrier = getCarrier(shipment.carrier);
  const result = await carrier.trackShipment(shipment.carrierShipmentId);
  if (result.status && result.status !== shipment.status) {
    await applyShipmentStatus(shipment, { status: result.status, eventTime: new Date(), source: "carrier_poll" });
  }
  return Shipment.findById(shipmentId);
}

// The one place Shipment.status actually changes after creation — shared
// by the webhook handler and the polling fallback so both paths get the
// exact same out-of-order-event guard and order-sync trigger.
async function applyShipmentStatus(shipment, { status, location, description, eventTime, source, metadata }) {
  // Always record the raw event for history (rule #38), even if it turns
  // out to be stale and doesn't move the shipment's current status.
  await ShipmentEvent.create({ shipment: shipment._id, status, location, description, eventTime, source, metadata });

  if (isStaleForwardEvent(shipment.status, status)) {
    return shipment; // rule #90 — don't revert a further-along shipment because a late/duplicate event arrived
  }
  // Forward-line events (created..delivered) are applied even when they
  // SKIP an intermediate stage — not every carrier emits every micro-status
  // (some never send READY_FOR_PICKUP/PICKED_UP separately, going straight
  // to IN_TRANSIT), and rule #90 only asks that status never move
  // backward, not that every step be present. The stricter step-by-step
  // graph (shipmentStateMachine's TRANSITIONS) is still enforced for the
  // branch transitions off that line (RTO, delivery_failed, cancelled),
  // where skipping is never legitimate.
  const bothOnForwardLine = isOnForwardLine(shipment.status) && isOnForwardLine(status);
  if (!bothOnForwardLine && !isValidTransitionOrSame(shipment.status, status)) {
    return shipment; // unrecognized/invalid branch transition for this carrier event — logged as history, not applied
  }

  shipment.status = status;
  if (status === "picked_up" && !shipment.shippedAt) shipment.shippedAt = eventTime;
  if (status === "delivered") shipment.deliveredAt = eventTime;
  if (status === "delivery_failed") shipment.failureReason = description;
  await shipment.save();

  // rule #119/#121 — ORDER_SHIPPED/OUT_FOR_DELIVERY/DELIVERED, keyed off the
  // normalized shipment status this function already guards for
  // out-of-order/duplicate events, so the notification layer inherits that
  // same protection for free.
  const SHIPMENT_STATUS_TO_EVENT = {
    picked_up: EVENT_TYPES.ORDER_SHIPPED,
    in_transit: EVENT_TYPES.ORDER_SHIPPED,
    out_for_delivery: EVENT_TYPES.ORDER_OUT_FOR_DELIVERY,
    delivered: EVENT_TYPES.ORDER_DELIVERED,
  };
  const eventType = SHIPMENT_STATUS_TO_EVENT[status];
  if (eventType) {
    const order = await Order.findById(shipment.order, "orderNumber user");
    if (order) await eventBus.publish(eventType, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(order.user), trackingNumber: shipment.trackingNumber }, { source: "shipment" });
  }

  if (status === "delivered") {
    const fulfillment = await Fulfillment.findById(shipment.fulfillment);
    if (fulfillment && fulfillment.status === "shipped") await fulfillmentService.markCompleted(fulfillment._id);
  }
  await syncOrderFulfillmentState(shipment.order);

  return shipment;
}

function isValidTransitionOrSame(from, to) {
  if (from === to) return true;
  try {
    assertValidShipmentTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

// POST /shipping/webhooks/:carrier — carrier-authenticated, idempotent.
export async function handleCarrierWebhook(carrierName, { rawBody, signature, body }) {
  const carrier = getCarrier(carrierName);

  if (!carrier.hasWebhookSecret()) fail("Webhook not configured", "WEBHOOK_NOT_CONFIGURED", 503);
  if (!carrier.verifyWebhookSignature({ rawBody, signature })) {
    fail("Invalid webhook signature", "WEBHOOK_VERIFICATION_FAILED", 400);
  }

  const parsed = carrier.parseWebhookEvent(body);
  if (!parsed.status) return { ok: true, ignored: true }; // unrecognized carrier status string

  try {
    await WebhookEvent.create({ provider: carrierName, providerEventId: parsed.eventId, type: parsed.status });
  } catch (err) {
    if (err.code === 11000) return { ok: true, duplicate: true }; // carrier retried an already-processed event
    throw err;
  }

  const shipment = await Shipment.findOne({ carrier: carrierName, carrierShipmentId: parsed.carrierShipmentId });
  if (!shipment) return { ok: true, ignored: true };

  await applyShipmentStatus(shipment, {
    status: parsed.status, location: parsed.location, description: parsed.description,
    eventTime: parsed.eventTime, source: "carrier_webhook",
  });

  return { ok: true };
}

export async function getShipmentsForOrder(orderId) {
  return Shipment.find({ order: orderId }).sort({ createdAt: 1 });
}

export async function getShipmentTracking(shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) fail("Shipment not found", "SHIPMENT_NOT_FOUND", 404);
  const events = await ShipmentEvent.find({ shipment: shipment._id }).sort({ eventTime: 1 });
  return { shipment, events };
}

export async function listShipmentsAdmin({ status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  const [shipments, total] = await Promise.all([
    Shipment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("order", "orderNumber"),
    Shipment.countDocuments(filter),
  ]);
  return { shipments, page, limit, total, totalPages: Math.ceil(total / limit) };
}
