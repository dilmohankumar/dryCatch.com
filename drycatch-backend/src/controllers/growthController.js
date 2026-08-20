import * as recentlyViewedService from "../services/growth/recentlyViewedService.js";
import * as recommendationService from "../services/growth/recommendationService.js";
import * as reorderService from "../services/growth/reorderService.js";
import * as stockAlertService from "../services/growth/stockAlertService.js";
import * as loyaltyService from "../services/growth/loyaltyService.js";
import * as referralService from "../services/growth/referralService.js";
import { isEnabled } from "../services/growth/featureFlagService.js";

// Customer-facing growth endpoints — every read/write scoped to
// req.user._id or the caller's own anonymousId/guest identity, never a
// client-supplied "userId" (IDOR — consistent with every earlier phase).

export async function recordProductView(req, res) {
  await recentlyViewedService.recordView({
    userId: req.user?._id,
    anonymousId: req.body.anonymousId,
    productId: req.body.productId,
  });
  res.status(202).json({ ok: true });
}

export async function getRecentlyViewed(req, res) {
  const items = await recentlyViewedService.listRecentlyViewed({
    userId: req.user?._id,
    anonymousId: req.query.anonymousId,
    limit: req.query.limit,
    excludeProductId: req.query.exclude,
  });
  res.json({ items });
}

export async function getRelatedProducts(req, res) {
  res.json({ items: await recommendationService.getRelatedProducts(req.params.productId, { limit: req.query.limit }) });
}

export async function getFrequentlyBoughtTogether(req, res) {
  res.json({ items: await recommendationService.getFrequentlyBoughtTogether(req.params.productId, { limit: req.query.limit }) });
}

export async function getReorderPreview(req, res) {
  res.json(await reorderService.getReorderPreview(req.params.orderId, req.user._id));
}

export async function postReorder(req, res) {
  res.json(await reorderService.reorder(req.params.orderId, req.user._id, req.cartIdentity));
}

export async function subscribeStockAlert(req, res) {
  res.status(201).json(await stockAlertService.subscribeToAlert(req.user._id, req.body));
}

export async function unsubscribeStockAlert(req, res) {
  res.json(await stockAlertService.unsubscribeFromAlert(req.user._id, req.params.id));
}

export async function listMyStockAlerts(req, res) {
  res.json({ alerts: await stockAlertService.listMyAlerts(req.user._id) });
}

export async function getMyLoyaltyBalance(req, res) {
  res.json({ balance: await loyaltyService.getBalance(req.user._id) });
}

export async function getMyLoyaltyLedger(req, res) {
  res.json(await loyaltyService.getLedger(req.user._id, req.query));
}

export async function getMyReferralCode(req, res) {
  const code = await referralService.getOrCreateCode(req.user._id);
  res.json({ code: code.code });
}

export async function getMyReferrals(req, res) {
  res.json({ referrals: await referralService.listMyReferrals(req.user._id) });
}

export async function checkFeatureFlag(req, res) {
  const enabled = await isEnabled(req.params.key, req.user?._id?.toString() || req.query.anonymousId);
  res.json({ key: req.params.key, enabled });
}
