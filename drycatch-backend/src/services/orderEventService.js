import OrderEvent from "../models/OrderEvent.js";

// Append-only — every meaningful order transition goes through this one
// function rather than services writing OrderEvent.create() inline
// themselves, so the shape (actorType required, etc.) stays consistent.
export async function recordOrderEvent(orderId, { type, fromStatus, toStatus, message, actorType, actorId, metadata }) {
  return OrderEvent.create({ order: orderId, type, fromStatus, toStatus, message, actorType, actorId, metadata });
}

export async function getTimeline(orderId) {
  return OrderEvent.find({ order: orderId }).sort({ createdAt: 1 });
}
