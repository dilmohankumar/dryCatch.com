import Order from "../../models/Order.js";

function fail(message, code, statusCode = 403) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// The only place "did this customer actually buy this?" gets decided —
// never the client (rule #7/#85). Policy: a customer becomes eligible once
// PAYMENT has succeeded on an order containing the product (not full
// delivery) — requiring DELIVERED would mean weeks before a review is
// possible on this platform's typical shipping timelines, and payment
// success is already a strong verified-purchase signal. This is a
// documented policy choice (rule #8 explicitly leaves it to the business),
// not an oversight.
export async function findEligibleOrderItem(userId, productId, variantId) {
  const orders = await Order.find({
    user: userId,
    paymentStatus: "succeeded",
    "items.product": productId,
  }).sort({ createdAt: -1 });

  for (const order of orders) {
    const item = order.items.find((i) => {
      const matchesProduct = String(i.product) === String(productId);
      const matchesVariant = !variantId || String(i.variant) === String(variantId);
      return matchesProduct && matchesVariant;
    });
    if (item) return { order, item };
  }
  return null;
}

// REVIEW_REQUIRE_PURCHASE (env, default "true") — the business policy knob
// rule #8 explicitly leaves open. Default is the stricter, spec-emphasized
// option (must have paid for the product to review it at all); set to
// "false" to allow any authenticated customer to review, with
// isVerifiedPurchase as a badge rather than a gate.
function requirePurchase() {
  return process.env.REVIEW_REQUIRE_PURCHASE !== "false";
}

// Returns eligibility + verified-purchase evidence in one call — used by
// reviewService.createReview so there's exactly one code path that decides
// "can this person review this, and were they verified."
export async function checkEligibility(userId, productId, variantId) {
  const match = await findEligibleOrderItem(userId, productId, variantId);
  if (!match && requirePurchase()) {
    return { eligible: false, isVerifiedPurchase: false };
  }
  return { eligible: true, isVerifiedPurchase: Boolean(match), order: match?.order, item: match?.item };
}

export { fail };
