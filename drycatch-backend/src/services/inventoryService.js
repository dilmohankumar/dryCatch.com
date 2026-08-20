import InventoryLocation from "../models/InventoryLocation.js";
import Inventory from "../models/Inventory.js";
import InventoryReservation from "../models/InventoryReservation.js";
import StockMovement from "../models/StockMovement.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { inventoryReservationOutcomeTotal } from "../utils/metrics.js";
import * as eventBus from "./notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";

// Threshold check shared by every stock-decrementing/incrementing path
// (rule #122) — fires only on the TRANSITION across a threshold, not on
// every write, so a variant sitting at 3 units doesn't re-fire LOW_STOCK
// on every subsequent sale.
async function checkStockThresholds({ variantId, prevOnHand, newOnHand, reorderLevel }) {
  if (prevOnHand > 0 && newOnHand <= 0) {
    await eventBus.publish(EVENT_TYPES.OUT_OF_STOCK, { entityId: String(variantId), variantId: String(variantId) }, { source: "inventory" });
  } else if (prevOnHand > reorderLevel && newOnHand > 0 && newOnHand <= reorderLevel) {
    await eventBus.publish(EVENT_TYPES.LOW_STOCK, { entityId: String(variantId), variantId: String(variantId) }, { source: "inventory" });
  } else if (prevOnHand <= 0 && newOnHand > 0) {
    await eventBus.publish(EVENT_TYPES.BACK_IN_STOCK, { entityId: String(variantId), variantId: String(variantId) }, { source: "inventory" });
  }
}

const RESERVATION_TTL_MS = (Number(process.env.RESERVATION_TTL_MINUTES) || 15) * 60 * 1000;

let mainLocationId = null;
export async function getDefaultLocation() {
  if (mainLocationId) return mainLocationId;
  const loc = await InventoryLocation.findOneAndUpdate(
    { code: "MAIN" },
    { $setOnInsert: { name: "Main Warehouse", code: "MAIN", status: "active" } },
    { new: true, upsert: true }
  );
  mainLocationId = loc._id;
  return loc._id;
}

async function resolveLocation(locationId) {
  return locationId || (await getDefaultLocation());
}

async function ensureInventoryDoc(variantId, locationId) {
  return Inventory.findOneAndUpdate(
    { variant: variantId, location: locationId },
    { $setOnInsert: { variant: variantId, location: locationId, quantityOnHand: 0, quantityReserved: 0 } },
    { new: true, upsert: true }
  );
}

// GET-style read — never used to gate a mutation (mutations always re-check
// atomically themselves; this is for display/availability only).
export async function getAvailability(variantId, locationId) {
  const location = await resolveLocation(locationId);
  const inv = await Inventory.findOne({ variant: variantId, location });
  const onHand = inv?.quantityOnHand ?? 0;
  const reserved = inv?.quantityReserved ?? 0;
  const available = onHand - reserved;
  const reorderLevel = inv?.reorderLevel ?? 10;
  const status = available <= 0 ? "out_of_stock" : available <= reorderLevel ? "low_stock" : "in_stock";
  return { onHand, reserved, available, reorderLevel, status };
}

// Cheap, indexed, lazily invoked (from reserveStock) rather than on a timer
// — no job scheduler exists in this project yet (see docs/inventory.md).
export async function releaseExpiredReservations(limit = 200) {
  const expired = await InventoryReservation.find({ status: "active", expiresAt: { $lt: new Date() } }).limit(limit);
  let count = 0;
  for (const r of expired) {
    const updated = await InventoryReservation.findOneAndUpdate(
      { _id: r._id, status: "active" },
      { $set: { status: "expired", releasedAt: new Date() } },
      { new: true }
    );
    if (!updated) continue; // someone else already resolved it
    await Inventory.updateOne({ variant: r.variant, location: r.location }, { $inc: { quantityReserved: -r.quantity } });
    await StockMovement.create({
      variant: r.variant, location: r.location, type: "RELEASE",
      quantity: r.quantity, referenceType: r.referenceType, referenceId: r.referenceId,
      reason: "Reservation expired",
    }).catch((err) => { if (err.code !== 11000) throw err; });
    count++;
  }
  return count;
}

// THE concurrency-critical operation. A single conditional findOneAndUpdate
// is what makes this safe under concurrent requests for the same variant:
// MongoDB serializes writes to one document, so of N concurrent callers
// requesting stock that can only satisfy M of them, exactly M succeed and
// N-M get "Insufficient stock" — never an oversell, and never a lost update
// from a separate find()-then-update() race.
export async function reserveStock({ variantId, locationId, quantity, referenceType = "order", referenceId }) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Object.assign(new Error("quantity must be a positive integer"), { statusCode: 400 });
  }
  if (!referenceId) throw Object.assign(new Error("referenceId is required"), { statusCode: 400 });

  const location = await resolveLocation(locationId);

  // Idempotency: a retried/duplicated request for the same reference+variant
  // must not reserve twice.
  const existing = await InventoryReservation.findOne({ referenceType, referenceId, variant: variantId });
  if (existing) return existing;

  await releaseExpiredReservations(50);
  await ensureInventoryDoc(variantId, location);

  const updated = await Inventory.findOneAndUpdate(
    {
      variant: variantId,
      location,
      $expr: { $gte: [{ $subtract: ["$quantityOnHand", "$quantityReserved"] }, quantity] },
    },
    { $inc: { quantityReserved: quantity } },
    { new: true }
  );
  if (!updated) {
    inventoryReservationOutcomeTotal.inc({ outcome: "insufficient_stock" });
    throw Object.assign(new Error("Insufficient stock"), { statusCode: 409 });
  }
  inventoryReservationOutcomeTotal.inc({ outcome: "reserved" });

  let reservation;
  try {
    reservation = await InventoryReservation.create({
      variant: variantId,
      location,
      quantity,
      referenceType,
      referenceId,
      status: "active",
      expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
    });
  } catch (err) {
    // Lost the create-race to a concurrent identical request — give back
    // the stock we just reserved (we don't need a second reservation) and
    // return whichever reservation actually won.
    await Inventory.updateOne({ variant: variantId, location }, { $inc: { quantityReserved: -quantity } });
    if (err.code === 11000) {
      return InventoryReservation.findOne({ referenceType, referenceId, variant: variantId });
    }
    throw err;
  }

  await StockMovement.create({ variant: variantId, location, type: "RESERVATION", quantity: -quantity, referenceType, referenceId })
    .catch((e) => { if (e.code !== 11000) throw e; });
  logAuditEvent("STOCK_RESERVED", null, { variantId: String(variantId), quantity, referenceType, referenceId });
  return reservation;
}

// Releases every still-active reservation for one reference (e.g. a failed
// payment or a cancelled pending order) — idempotent per reservation via the
// status:"active" guard on each individual update.
export async function releaseReservationsForReference(referenceType, referenceId) {
  const reservations = await InventoryReservation.find({ referenceType, referenceId, status: "active" });
  let released = 0;
  for (const r of reservations) {
    const updated = await InventoryReservation.findOneAndUpdate(
      { _id: r._id, status: "active" },
      { $set: { status: "released", releasedAt: new Date() } },
      { new: true }
    );
    if (!updated) continue;
    await Inventory.updateOne({ variant: r.variant, location: r.location }, { $inc: { quantityReserved: -r.quantity } });
    await StockMovement.create({
      variant: r.variant, location: r.location, type: "RELEASE",
      quantity: r.quantity, referenceType, referenceId, reason: "Reservation released",
    }).catch((e) => { if (e.code !== 11000) throw e; });
    released++;
  }
  if (released) logAuditEvent("STOCK_RELEASED", null, { referenceType, referenceId, count: released });
  return released;
}

// Converts reservation → permanent stock deduction (on payment success).
// Idempotent: a reservation already committed/released/expired is simply
// skipped, so a duplicated webhook + client-side verify can't double-deduct.
export async function commitReservationsForReference(referenceType, referenceId, userId) {
  const reservations = await InventoryReservation.find({ referenceType, referenceId, status: "active" });
  const committed = [];
  for (const r of reservations) {
    const updatedRes = await InventoryReservation.findOneAndUpdate(
      { _id: r._id, status: "active" },
      { $set: { status: "committed" } },
      { new: true }
    );
    if (!updatedRes) continue;
    const before = await Inventory.findOne({ variant: r.variant, location: r.location }, "quantityOnHand reorderLevel");
    await Inventory.updateOne(
      { variant: r.variant, location: r.location },
      { $inc: { quantityOnHand: -r.quantity, quantityReserved: -r.quantity } }
    );
    if (before) {
      await checkStockThresholds({
        variantId: r.variant,
        prevOnHand: before.quantityOnHand,
        newOnHand: before.quantityOnHand - r.quantity,
        reorderLevel: before.reorderLevel ?? 10,
      });
    }
    await StockMovement.create({
      variant: r.variant, location: r.location, type: "SALE",
      quantity: -r.quantity, referenceType, referenceId, createdBy: userId,
    }).catch((e) => { if (e.code !== 11000) throw e; });
    committed.push(updatedRes);
  }
  if (committed.length) logAuditEvent("STOCK_COMMITTED", userId, { referenceType, referenceId, count: committed.length });
  return committed;
}

// Manual admin stock change — every call requires a reason (rule: no
// unexplained adjustments) and is itself atomic/condition-guarded so on-hand
// can never go negative even under concurrent adjustments.
export async function adjustStock({ variantId, locationId, delta, reason, userId, type = "MANUAL_ADJUSTMENT" }) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw Object.assign(new Error("delta must be a non-zero integer"), { statusCode: 400 });
  }
  if (!reason || !String(reason).trim()) {
    throw Object.assign(new Error("A reason is required for every stock adjustment"), { statusCode: 400 });
  }

  const location = await resolveLocation(locationId);
  await ensureInventoryDoc(variantId, location);

  const filter = { variant: variantId, location };
  if (delta < 0) filter.$expr = { $gte: [{ $add: ["$quantityOnHand", delta] }, 0] };

  const updated = await Inventory.findOneAndUpdate(filter, { $inc: { quantityOnHand: delta } }, { new: true });
  if (!updated) {
    throw Object.assign(new Error("Adjustment would result in negative stock"), { statusCode: 409 });
  }

  await checkStockThresholds({
    variantId,
    prevOnHand: updated.quantityOnHand - delta,
    newOnHand: updated.quantityOnHand,
    reorderLevel: updated.reorderLevel ?? 10,
  });

  await StockMovement.create({ variant: variantId, location, type, quantity: delta, reason, createdBy: userId });
  logAuditEvent(delta > 0 ? "STOCK_RECEIVED" : "STOCK_ADJUSTED", userId, { variantId: String(variantId), delta, reason });
  return updated;
}

export async function receiveStock({ variantId, locationId, quantity, reason, userId }) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Object.assign(new Error("quantity must be a positive integer"), { statusCode: 400 });
  }
  return adjustStock({ variantId, locationId, delta: quantity, reason: reason || "Stock received", userId, type: "PURCHASE_RECEIPT" });
}

export async function listInventory({ search, status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  let query = Inventory.find(filter).populate({
    path: "variant",
    select: "sku weight attributes product",
    populate: { path: "product", select: "name slug" },
  });

  if (search) {
    // Search by SKU/product name — filtered in-memory after populate since
    // it spans two collections; fine at admin-console scale, not meant for
    // a 100k-SKU catalog (see docs/inventory.md performance notes).
    const all = await query;
    const term = String(search).toLowerCase();
    const filtered = all.filter(
      (inv) =>
        inv.variant?.sku?.toLowerCase().includes(term) ||
        inv.variant?.product?.name?.toLowerCase().includes(term)
    );
    const start = (pageNum - 1) * limitNum;
    return { items: filtered.slice(start, start + limitNum), totalItems: filtered.length, page: pageNum, limit: limitNum };
  }

  const [items, totalItems] = await Promise.all([
    query.skip((pageNum - 1) * limitNum).limit(limitNum),
    Inventory.countDocuments(filter),
  ]);
  return { items, totalItems, page: pageNum, limit: limitNum };
}

export async function listMovements({ variantId, sku, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (variantId) filter.variant = variantId;
  if (sku) {
    const ProductVariant = (await import("../models/ProductVariant.js")).default;
    const variant = await ProductVariant.findOne({ sku: String(sku).toUpperCase().trim() });
    filter.variant = variant?._id || null; // no match → empty result, not "ignore filter"
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  const [items, totalItems] = await Promise.all([
    StockMovement.find(filter)
      .populate({ path: "variant", select: "sku product", populate: { path: "product", select: "name" } })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    StockMovement.countDocuments(filter),
  ]);
  return { items, totalItems, page: pageNum, limit: limitNum };
}
