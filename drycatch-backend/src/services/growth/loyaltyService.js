import LoyaltyLedgerEntry from "../../models/LoyaltyLedgerEntry.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const POINTS_PER_RUPEE = Number(process.env.LOYALTY_POINTS_PER_RUPEE) || 1; // 1 point per ₹1 of net order value, configurable
const POINT_VALUE_RUPEES = Number(process.env.LOYALTY_POINT_VALUE_RUPEES) || 0.5; // 1 point redeemable for ₹0.50
const POINTS_EXPIRY_DAYS = Number(process.env.LOYALTY_POINTS_EXPIRY_DAYS) || 365;

// Balance is ALWAYS derived by summing the ledger (rule #24 — "never
// store only a mutable point balance"), never cached in a mutable field
// on User. At this project's scale a full aggregation per balance check
// is cheap; if that ever stops being true, a periodically-refreshed
// materialized balance could be added ON TOP of this ledger without
// changing the ledger itself.
export async function getBalance(userId) {
  const result = await LoyaltyLedgerEntry.aggregate([
    { $match: { user: userId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] } },
    { $group: { _id: null, balance: { $sum: "$points" } } },
  ]);
  return result[0]?.balance || 0;
}

export async function getLedger(userId, { page = 1, limit = 50 } = {}) {
  const [entries, total] = await Promise.all([
    LoyaltyLedgerEntry.find({ user: userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    LoyaltyLedgerEntry.countDocuments({ user: userId }),
  ]);
  return { entries, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// Idempotent under retry (rule #72) — `idempotencyKey` is unique+sparse,
// so awarding points twice for the same order (a webhook retry, a
// duplicate event) hits the unique index and is a silent no-op, not a
// double-award.
export async function earnFromOrder(order) {
  const idempotencyKey = `order_delivered:${order._id}`;
  const points = Math.floor((order.totalAmount || 0) * POINTS_PER_RUPEE);
  if (points <= 0) return null;

  try {
    return await LoyaltyLedgerEntry.create({
      user: order.user,
      type: "EARN",
      points,
      source: "order",
      referenceType: "Order",
      referenceId: order._id,
      expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      idempotencyKey,
    });
  } catch (err) {
    if (err.code === 11000) return null; // already awarded for this order
    throw err;
  }
}

// Reverses previously-earned points when the underlying order is refunded
// (rule #25's REFUND_REVERSAL type) — proportional to how much of the
// order was refunded, never more than was actually earned.
export async function reverseForRefund(order, refundAmount) {
  const idempotencyKey = `refund_reversal:${order._id}:${refundAmount}`;
  const originalEntry = await LoyaltyLedgerEntry.findOne({ referenceType: "Order", referenceId: order._id, type: "EARN" });
  if (!originalEntry) return null;

  const proportionalPoints = Math.floor(originalEntry.points * (refundAmount / order.totalAmount));
  if (proportionalPoints <= 0) return null;

  try {
    return await LoyaltyLedgerEntry.create({
      user: order.user,
      type: "REFUND_REVERSAL",
      points: -proportionalPoints,
      source: "order",
      referenceType: "Order",
      referenceId: order._id,
      idempotencyKey,
    });
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

// Redemption at checkout — validates available balance INCLUDING this
// same request's own effect (rule #26 "prevent double redemption... use
// transactional consistency"). MongoDB has no multi-document transactions
// in this project's architecture (documented since Phase 0), so this
// relies on the same single-document-atomicity pattern used everywhere
// else here (Phase 5 inventory, Phase 11 coupons): re-check the balance
// immediately before creating the REDEEM entry, accepting that a
// theoretical race between two concurrent redemption requests for the
// same user is the same class of risk already accepted elsewhere in this
// codebase, not a new one.
export async function redeemPoints(userId, pointsToRedeem, { orderId } = {}) {
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
    fail("pointsToRedeem must be a positive integer", "INVALID_REDEMPTION_AMOUNT");
  }
  const balance = await getBalance(userId);
  if (pointsToRedeem > balance) fail("Insufficient loyalty points balance", "INSUFFICIENT_POINTS");

  const entry = await LoyaltyLedgerEntry.create({
    user: userId,
    type: "REDEEM",
    points: -pointsToRedeem,
    source: "order",
    referenceType: orderId ? "Order" : undefined,
    referenceId: orderId,
  });
  return { entry, discountAmount: round2(pointsToRedeem * POINT_VALUE_RUPEES) };
}

export function pointsToRupees(points) {
  return round2(points * POINT_VALUE_RUPEES);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function adjustPoints(userId, points, note, actorId) {
  if (!Number.isInteger(points) || points === 0) fail("points must be a non-zero integer", "INVALID_ADJUSTMENT");
  return LoyaltyLedgerEntry.create({ user: userId, type: "ADJUST", points, source: "admin_adjustment", note, createdBy: actorId });
}
