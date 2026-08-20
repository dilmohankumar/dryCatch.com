import Cart from "../../models/Cart.js";
import CartItem from "../../models/CartItem.js";
import Notification from "../../models/Notification.js";
import * as inventoryService from "../inventoryService.js";
import { publish } from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";
import { checkoutOutcomeTotal } from "../../utils/metrics.js";

const ABANDONMENT_THRESHOLD_MS = (Number(process.env.CART_ABANDONMENT_HOURS) || 2) * 60 * 60 * 1000;

// Phase 24 — finally wires the ABANDONED_CART event that Phase 16 already
// defined a notification rule and default copy for, but nothing ever
// published (confirmed dead code by this phase's audit — `grep
// ABANDONED_CART` found the rule/content but zero `publish()` call
// sites). No real job scheduler exists in this project (the same honest
// gap documented since Phase 16) — this is an admin-triggered/interval-
// callable sweep, exactly like every other "scheduled" operation here
// (CMS's processScheduledPages, notifications' processRetries, etc.),
// not a fake cron.
export async function processAbandonedCarts({ limit = 200 } = {}) {
  const cutoff = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);

  // Only carts that are: still "active" (never abandon a converted/expired
  // cart a second time), belong to a real, identifiable user (a guest cart
  // has no email to notify — rule #13's "validate customer consent" starts
  // with actually knowing who the customer is), and haven't been touched
  // recently.
  const candidates = await Cart.find({ status: "active", user: { $ne: null }, updatedAt: { $lte: cutoff } })
    .limit(limit)
    .populate("user", "email");

  let notified = 0;
  let skippedEmpty = 0;
  let skippedNoStock = 0;

  for (const cart of candidates) {
    const items = await CartItem.find({ cart: cart._id }).populate("variant", "price");
    if (items.length === 0) {
      skippedEmpty++;
      continue;
    }

    // Re-validate inventory at send time (rule #13 "check inventory
    // availability") — a reminder for a cart that's now entirely
    // unbuyable would just frustrate the customer, not recover a sale.
    const stillAvailable = [];
    for (const item of items) {
      if (!item.variant) continue;
      const availability = await inventoryService.getAvailability(item.variant._id);
      if (availability.available > 0) stillAvailable.push(item);
    }
    if (stillAvailable.length === 0) {
      skippedNoStock++;
      continue;
    }

    // Must exactly match notificationEngine.js's own dedupeKey formula
    // (`${eventType}:${userId}:${entityId}`) — passing `entityId` (not
    // just `cartId`) in the publish payload below is what makes the
    // engine's dedupe key actually per-cart, not just per-user (a user
    // with two separately-abandoned carts must get two reminders, not
    // have the second silently swallowed by the first's dedupe record).
    const dedupeKey = `${EVENT_TYPES.ABANDONED_CART}:${cart.user._id}:${cart._id}`;
    const alreadyNotified = await Notification.findOne({ dedupeKey });
    if (alreadyNotified) continue; // rule #13 "do not spam" — one reminder per cart, ever

    await publish(EVENT_TYPES.ABANDONED_CART, { userId: String(cart.user._id), entityId: String(cart._id), cartId: String(cart._id) }, { source: "growth" });
    checkoutOutcomeTotal.inc({ outcome: "cart_abandoned_reminder_sent" });
    notified++;
  }

  return { candidatesChecked: candidates.length, notified, skippedEmpty, skippedNoStock };
}
