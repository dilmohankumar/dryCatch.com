import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import { subscribe } from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";
import * as loyaltyService from "./loyaltyService.js";
import * as referralService from "./referralService.js";

// Phase 24 — wires growth side-effects to the SAME event bus every other
// phase already publishes to, rather than adding new call sites into
// order/payment services directly (reuse, not duplication — rule #4 of
// the architecture principle governing this whole project).
export function registerGrowthEngine() {
  // Loyalty points earned on delivery (not order creation) — a returned/
  // cancelled/undelivered order should never have already granted points.
  subscribe(EVENT_TYPES.ORDER_DELIVERED, async ({ orderId }) => {
    const order = await Order.findById(orderId);
    if (!order) return;
    await loyaltyService.earnFromOrder(order).catch(() => {});
  });

  // Loyalty reversal + referral qualification both react to a completed
  // order, at different trigger points.
  subscribe(EVENT_TYPES.REFUND_COMPLETED, async ({ orderId }) => {
    const order = await Order.findById(orderId);
    if (!order) return;
    const payment = await Payment.findOne({ order: orderId }).sort({ createdAt: -1 });
    if (!payment) return;
    await loyaltyService.reverseForRefund(order, payment.refundedAmount).catch(() => {});
  });

  // A referral qualifies on the referred customer's FIRST real order
  // (rule #27's "QUALIFYING ACTION"), not merely signing up — referralService
  // itself checks whether this order is genuinely that user's first.
  subscribe(EVENT_TYPES.ORDER_CONFIRMED, async ({ orderId, userId }) => {
    await referralService.tryQualifyReferral(userId, orderId).catch(() => {});
  });
}
