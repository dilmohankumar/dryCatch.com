import StockAlertSubscription from "../../models/StockAlertSubscription.js";
import ProductVariant from "../../models/ProductVariant.js";
import Product from "../../models/Product.js";
import Notification from "../../models/Notification.js";
import { subscribe, publish } from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";
import { createAndProcessDeliveries } from "../notifications/deliveryService.js";
import * as emailChannel from "../notifications/channels/emailChannel.js";

function fail(message, code, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode, code });
}

export async function subscribeToAlert(userId, { productId, variantId, type }) {
  const product = await Product.findById(productId, "price status");
  if (!product) fail("Product not found", "PRODUCT_NOT_FOUND", 404);

  const existing = await StockAlertSubscription.findOne({ user: userId, product: productId, variant: variantId, type });
  if (existing) {
    if (existing.status === "notified") {
      // A customer re-subscribing after already being notified once
      // (rule #20/#21 "prevent duplicate alerts") gets a fresh active
      // subscription rather than being silently stuck in "notified"
      // forever.
      existing.status = "active";
      existing.notifiedAt = undefined;
      if (type === "price_drop") existing.observedPrice = product.price;
      await existing.save();
      return existing;
    }
    return existing; // already actively subscribed — idempotent, not an error
  }

  return StockAlertSubscription.create({
    user: userId,
    product: productId,
    variant: variantId,
    type,
    observedPrice: type === "price_drop" ? product.price : undefined,
  });
}

export async function unsubscribeFromAlert(userId, subscriptionId) {
  const result = await StockAlertSubscription.findOneAndUpdate(
    { _id: subscriptionId, user: userId },
    { $set: { status: "cancelled" } },
    { new: true }
  );
  if (!result) fail("Subscription not found", "SUBSCRIPTION_NOT_FOUND", 404);
  return result;
}

export async function listMyAlerts(userId) {
  return StockAlertSubscription.find({ user: userId, status: "active" }).populate("product", "name slug media").sort({ createdAt: -1 });
}

// Sends one real notification per active subscriber — reuses Phase 16's
// Notification/delivery pipeline directly rather than routing through the
// generic rule-based notificationEngine (that path assumes one rule = one
// notification; here it's genuinely N subscribers = N targeted
// notifications, each keyed to its own user).
async function notifySubscribers(subscriptions, { title, body, data }) {
  for (const sub of subscriptions) {
    const dedupeKey = `${sub.type}:${sub.user}:${sub.product}:${sub.variant || ""}`;
    const alreadySent = await Notification.findOne({ dedupeKey });
    if (alreadySent) continue;

    const notification = await Notification.create({
      user: sub.user,
      recipientType: "customer",
      eventType: sub.type === "back_in_stock" ? EVENT_TYPES.BACK_IN_STOCK : EVENT_TYPES.PRICE_DROPPED,
      category: "system",
      priority: "low",
      title,
      body,
      data,
      channels: ["email", "in_app"],
      dedupeKey,
    });
    const email = await emailChannel.resolveRecipient(sub.user);
    await createAndProcessDeliveries(notification, { email });

    sub.status = "notified";
    sub.notifiedAt = new Date();
    await sub.save();
  }
}

// Subscribes to the SAME eventBus Phase 16/17 already use — when a
// variant crosses back above its reorder threshold (inventoryService's
// checkStockThresholds, unchanged), every active back_in_stock subscriber
// for that variant gets a real, individually-targeted notification. This
// is the fix for the exact gap Phase 16's own report flagged: "payload
// has no userId... notification stays inert."
export function registerStockAlertSubscribers() {
  subscribe(EVENT_TYPES.BACK_IN_STOCK, async ({ variantId }) => {
    const subs = await StockAlertSubscription.find({ variant: variantId, type: "back_in_stock", status: "active" });
    if (!subs.length) return;
    const variant = await ProductVariant.findById(variantId).populate("product", "name slug");
    if (!variant) return;
    await notifySubscribers(subs, {
      title: "Back in stock!",
      body: `${variant.product?.name || "An item on your wishlist"} is back in stock.`,
      data: { productId: String(variant.product?._id), actionUrl: `/products/${variant.product?.slug}` },
    });
  });

  subscribe(EVENT_TYPES.PRICE_DROPPED, async ({ productId, newPrice }) => {
    const subs = await StockAlertSubscription.find({ product: productId, type: "price_drop", status: "active", observedPrice: { $gt: newPrice } });
    if (!subs.length) return;
    const product = await Product.findById(productId, "name slug");
    if (!product) return;
    await notifySubscribers(subs, {
      title: "Price drop!",
      body: `${product.name} is now ₹${newPrice} — lower than when you subscribed.`,
      data: { productId: String(product._id), actionUrl: `/products/${product.slug}` },
    });
  });
}

// Called from variantService.updateVariant when a price actually
// decreases (rule #21 — never a fabricated/guessed price event).
export async function checkPriceDrop(productId, previousPrice, newPrice) {
  if (newPrice < previousPrice) {
    await publish(EVENT_TYPES.PRICE_DROPPED, { productId: String(productId), previousPrice, newPrice }, { source: "growth" });
  }
}
