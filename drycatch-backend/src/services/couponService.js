import Coupon from "../models/Coupon.js";

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Frontend sends only a code; every other coupon fact — validity, eligibility,
// discount amount — is decided here. A discount is never accepted verbatim
// from the client.
export async function validateAndApplyCoupon(code, { subtotal }) {
  if (!code) throw Object.assign(new Error("Coupon code is required"), { statusCode: 400, code: "COUPON_INVALID" });

  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim(), status: "active" });
  const fail = (message) => {
    throw Object.assign(new Error(message), { statusCode: 400, code: "COUPON_INVALID" });
  };

  if (!coupon) fail("This coupon code is not valid");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) fail("This coupon has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) fail("This coupon has reached its usage limit");
  if (subtotal < coupon.minSubtotal) fail(`This coupon requires a minimum order of ₹${coupon.minSubtotal}`);

  let discount = coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal); // never a negative total

  return { discountAmount: round2(discount), couponId: coupon._id };
}

export async function recordCouponUsage(code) {
  await Coupon.updateOne({ code: String(code).toUpperCase().trim() }, { $inc: { usedCount: 1 } });
}
