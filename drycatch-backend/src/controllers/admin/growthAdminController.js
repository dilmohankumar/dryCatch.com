import * as featureFlagService from "../../services/growth/featureFlagService.js";
import * as loyaltyService from "../../services/growth/loyaltyService.js";
import * as abandonedCartService from "../../services/growth/abandonedCartService.js";
import Referral from "../../models/Referral.js";
import { logAuditEvent } from "../../utils/auditLog.js";

// Feature flags
export async function listFlags(req, res) {
  res.json({ flags: await featureFlagService.listFlags() });
}
export async function createFlag(req, res) {
  const flag = await featureFlagService.createFlag(req.body, req.user._id);
  logAuditEvent("FEATURE_FLAG_CREATED", req.user._id, { key: flag.key });
  res.status(201).json(flag);
}
export async function updateFlag(req, res) {
  const flag = await featureFlagService.updateFlag(req.params.id, req.body, req.user._id);
  // Feature flags can affect checkout/payment behavior (rule #48) —
  // every change is audited, same as any other sensitive admin action.
  logAuditEvent("FEATURE_FLAG_UPDATED", req.user._id, { key: flag.key, enabled: flag.enabled, rolloutPercent: flag.rolloutPercent });
  res.json(flag);
}

// Loyalty (admin oversight)
export async function getCustomerLoyalty(req, res) {
  const [balance, ledger] = await Promise.all([
    loyaltyService.getBalance(req.params.userId),
    loyaltyService.getLedger(req.params.userId, req.query),
  ]);
  res.json({ balance, ...ledger });
}
export async function adjustCustomerLoyalty(req, res) {
  const { points, note } = req.body;
  const entry = await loyaltyService.adjustPoints(req.params.userId, points, note, req.user._id);
  logAuditEvent("LOYALTY_POINTS_ADJUSTED", req.user._id, { targetUserId: req.params.userId, points, note });
  res.status(201).json(entry);
}

// Referrals (admin oversight)
export async function listReferrals(req, res) {
  const { status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const [referrals, total] = await Promise.all([
    Referral.find(filter).populate("referrer", "firstName lastName email").populate("referredUser", "firstName lastName email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Referral.countDocuments(filter),
  ]);
  res.json({ referrals, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}
export async function rejectReferral(req, res) {
  const referral = await Referral.findByIdAndUpdate(req.params.id, { $set: { status: "rejected", rejectionReason: req.body.reason } }, { new: true });
  if (!referral) return res.status(404).json({ message: "Referral not found" });
  logAuditEvent("REFERRAL_REJECTED", req.user._id, { referralId: referral._id, reason: req.body.reason });
  res.json(referral);
}

// Abandoned cart sweep — admin-triggered (no real job scheduler exists in
// this project, same honest pattern as every other "scheduled" operation
// since Phase 16).
export async function triggerAbandonedCartSweep(req, res) {
  const result = await abandonedCartService.processAbandonedCarts(req.body);
  logAuditEvent("ABANDONED_CART_SWEEP_TRIGGERED", req.user._id, result);
  res.json(result);
}
