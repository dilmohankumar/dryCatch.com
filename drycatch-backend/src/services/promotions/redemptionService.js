import Coupon from "../../models/Coupon.js";
import Promotion from "../../models/Promotion.js";
import CouponRedemption from "../../models/CouponRedemption.js";
import CouponCustomerUsage from "../../models/CouponCustomerUsage.js";

function fail(message, code, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// The atomic global-usage gate (rule #23/#24) — a conditional increment,
// never a separate read-then-compare-then-write. Two concurrent callers
// racing for the last usage of a `usageLimit: 1` coupon: exactly one
// `findOneAndUpdate` matches (usageCount still < limit) and increments;
// the other finds no matching document and gets null back. Same pattern as
// Phase 5's inventory reservation and Phase 7's checkout claim.
async function incrementCouponUsage(couponId, effectiveLimit) {
  const filter = { _id: couponId, status: "active" };
  if (effectiveLimit != null) filter.$expr = { $lt: ["$usageCount", effectiveLimit] };
  return Coupon.findOneAndUpdate(filter, { $inc: { usageCount: 1 } }, { new: true });
}

async function decrementCouponUsage(couponId) {
  await Coupon.updateOne({ _id: couponId, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
}

async function incrementPromotionUsage(promotionId, effectiveLimit) {
  const filter = { _id: promotionId, status: "active" };
  if (effectiveLimit != null) filter.$expr = { $lt: ["$usageCount", effectiveLimit] };
  return Promotion.findOneAndUpdate(filter, { $inc: { usageCount: 1 } }, { new: true });
}

async function decrementPromotionUsage(promotionId) {
  await Promotion.updateOne({ _id: promotionId, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
}

// Race-safe per-customer usage counter (rule #22), any limit value — not
// just 1. Two concurrent requests for the same (coupon, customer) pair:
// the conditional findOneAndUpdate wins for whichever arrives while
// count < limit; if neither doc exists yet, both race on `create`, the
// unique {coupon, customer} index lets exactly one succeed, and the loser
// falls through to the catch and is correctly rejected.
async function incrementCustomerUsage(couponId, customerId, limit) {
  const updated = await CouponCustomerUsage.findOneAndUpdate(
    { coupon: couponId, customer: customerId, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );
  if (updated) return true;
  try {
    await CouponCustomerUsage.create({ coupon: couponId, customer: customerId, count: 1 });
    return true;
  } catch (err) {
    if (err.code === 11000) return false; // created concurrently by the other racer, already at/over limit
    throw err;
  }
}

async function decrementCustomerUsage(couponId, customerId) {
  await CouponCustomerUsage.updateOne({ coupon: couponId, customer: customerId, count: { $gt: 0 } }, { $inc: { count: -1 } });
}

// Called from checkoutService.placeOrder, alongside inventory reservation
// and payment creation — this is the moment a coupon's usage becomes real
// (rule #27: applying a coupon in cart is not the same as redeeming it).
export async function redeemCoupon({ couponId, promotionId, customerId, checkoutId, discountAmount }) {
  const coupon = await Coupon.findById(couponId).populate("promotion");
  if (!coupon) fail("Coupon no longer exists", "COUPON_NOT_FOUND", 404);

  const effectiveUsageLimit = coupon.usageLimit ?? coupon.promotion.usageLimit;
  const claimed = await incrementCouponUsage(couponId, effectiveUsageLimit);
  if (!claimed) fail("This coupon has reached its usage limit", "COUPON_USAGE_LIMIT_REACHED");

  const effectivePerCustomerLimit = coupon.perCustomerLimit ?? coupon.promotion.perCustomerLimit ?? 1;
  const customerOk = await incrementCustomerUsage(couponId, customerId, effectivePerCustomerLimit);
  if (!customerOk) {
    await decrementCouponUsage(couponId); // release the global slot we just claimed
    fail("You've already used this coupon", "COUPON_CUSTOMER_LIMIT_REACHED");
  }

  const redemption = await CouponRedemption.create({
    coupon: couponId, promotion: promotionId, customer: customerId, checkout: checkoutId,
    discountAmount, status: "redeemed",
  });
  return redemption;
}

// Automatic (no-code) promotions with a usageLimit still need the same
// atomic protection, just against Promotion.usageCount directly — no
// Coupon/per-customer layer, since this system's automatic promotions
// don't carry a per-customer limit concept (a coupon is what gives a
// promotion customer-specific redemption tracking here).
export async function redeemAutomaticPromotion({ promotionId, customerId, checkoutId, discountAmount }) {
  const promotion = await Promotion.findById(promotionId);
  if (!promotion) fail("Promotion no longer exists", "COUPON_NOT_FOUND", 404);
  if (promotion.usageLimit != null) {
    const claimed = await incrementPromotionUsage(promotionId, promotion.usageLimit);
    if (!claimed) fail("This promotion has reached its usage limit", "COUPON_USAGE_LIMIT_REACHED");
  }
  return CouponRedemption.create({
    promotion: promotionId, customer: customerId, checkout: checkoutId, discountAmount, status: "redeemed",
  });
}

// Called when an order that redeemed a coupon fails before payment
// succeeds (order-creation failure, payment failure, or a pre-payment
// cancellation) — rule #28/#29: a payment failure or pre-payment
// cancellation must not permanently consume the coupon. Once payment has
// actually succeeded, the redemption is treated as final (see
// docs/promotions.md for the explicit policy) — a LATER cancellation or
// refund does not call this.
export async function releaseRedemption(redemptionId) {
  const redemption = await CouponRedemption.findById(redemptionId);
  if (!redemption || redemption.status !== "redeemed") return;

  if (redemption.coupon) {
    await decrementCouponUsage(redemption.coupon);
    await decrementCustomerUsage(redemption.coupon, redemption.customer);
  } else if (redemption.promotion) {
    await decrementPromotionUsage(redemption.promotion);
  }
  redemption.status = "released";
  await redemption.save();
}

export async function releaseRedemptionsForCheckout(checkoutId) {
  const redemptions = await CouponRedemption.find({ checkout: checkoutId, status: "redeemed" });
  for (const r of redemptions) await releaseRedemption(r._id);
}
