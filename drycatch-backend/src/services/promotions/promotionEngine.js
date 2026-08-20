import Promotion from "../../models/Promotion.js";
import Coupon from "../../models/Coupon.js";
import CouponCustomerUsage from "../../models/CouponCustomerUsage.js";
import Product from "../../models/Product.js";
import { evaluatePromotion } from "./ruleEvaluator.js";
import { getStrategy } from "./strategies/index.js";
import { mergeAllocations } from "./discountAllocator.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

async function buildCategoryByProduct(items) {
  const productIds = items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } }, "category");
  return new Map(products.map((p) => [String(p._id), p.category]));
}

// Indexed query, not "load every promotion and filter in JS" (rule #106) —
// status + requiresCoupon + date range are all covered by
// Promotion's {status, startAt, endAt} and {requiresCoupon, status} indexes.
async function getAutomaticCandidates() {
  const now = new Date();
  return Promotion.find({
    status: "active",
    requiresCoupon: false,
    $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
    ],
  }).sort({ priority: -1 });
}

// Coupon codes are normalized (rule #6) — "save10"/"SAVE10"/"Save10" all
// resolve to the same Coupon document.
export async function findCouponWithPromotion(code) {
  const normalized = String(code).toUpperCase().trim();
  const coupon = await Coupon.findOne({ code: normalized }).populate("promotion");
  return coupon;
}

function effectiveDates(coupon, promotion) {
  return {
    effectiveStartAt: coupon?.startAt ?? promotion.startAt,
    effectiveEndAt: coupon?.endAt ?? promotion.endAt,
  };
}

// Non-atomic, fast-path usage check for immediate UX feedback (rejecting
// an obviously-exhausted coupon, or one this customer already used,
// without waiting until placeOrder's atomic redemption to find out). The
// real, race-safe enforcement happens in redemptionService.js at actual
// redemption time — this is advisory only, exactly like Checkout's own
// revalidate-then-claim pattern from Phase 7. Skipping the per-customer
// check here would still be SAFE (redemption-time enforcement is atomic
// regardless), just bad UX — a coupon that "applies successfully" only to
// be rejected later at place-order.
async function checkUsagePreflight(coupon, promotion, customerId) {
  const usageLimit = coupon.usageLimit ?? promotion.usageLimit;
  const usageCount = coupon.usageCount; // the coupon's own counter is authoritative once a coupon exists
  if (usageLimit != null && usageCount >= usageLimit) {
    return { eligible: false, code: "COUPON_USAGE_LIMIT_REACHED", message: "This coupon has reached its usage limit" };
  }
  const perCustomerLimit = coupon.perCustomerLimit ?? promotion.perCustomerLimit ?? 1;
  const usage = await CouponCustomerUsage.findOne({ coupon: coupon._id, customer: customerId });
  if (usage && usage.count >= perCustomerLimit) {
    return { eligible: false, code: "COUPON_CUSTOMER_LIMIT_REACHED", message: "You've already used this coupon" };
  }
  return { eligible: true };
}

function structuredCouponError(code) {
  const messages = {
    COUPON_NOT_FOUND: "This coupon code is not valid",
    COUPON_NOT_ACTIVE: "This coupon is not active",
    COUPON_EXPIRED: "This coupon has expired",
    COUPON_USAGE_LIMIT_REACHED: "This coupon has reached its usage limit",
    COUPON_CUSTOMER_LIMIT_REACHED: "You've already used this coupon",
    COUPON_MINIMUM_ORDER_NOT_MET: "Your order doesn't meet this coupon's minimum",
    COUPON_NOT_ELIGIBLE: "This coupon isn't available for your account",
    COUPON_NOT_APPLICABLE: "This coupon doesn't apply to the items in your cart",
    COUPON_STACKING_NOT_ALLOWED: "This coupon can't be combined with another active offer",
  };
  return messages[code] || "This coupon is not valid";
}

// Resolves conflicts deterministically (rule #40-42) rather than letting
// database/array ordering decide: an eligible EXCLUSIVE promotion wins
// alone; otherwise every STACKABLE-eligible promotion combines, plus at
// most one non-stackable one (the highest-priority among them).
function resolveStacking(candidates) {
  const exclusive = candidates.filter((c) => c.promotion.exclusive);
  if (exclusive.length) {
    exclusive.sort((a, b) => b.promotion.priority - a.promotion.priority);
    return [exclusive[0]];
  }
  const stackable = candidates.filter((c) => c.promotion.stackable);
  const nonStackable = candidates.filter((c) => !c.promotion.stackable);
  nonStackable.sort((a, b) => b.promotion.priority - a.promotion.priority);
  return nonStackable.length ? [...stackable, nonStackable[0]] : stackable;
}

// The single entry point checkoutService calls on every cart mutation
// (rule #87) — evaluates automatic promotions AND an applied coupon
// together, resolves stacking, and returns one merged result. Never
// mutates anything; pure evaluation, same "compute, don't commit" shape as
// Phase 7's recomputePricing.
export async function evaluateCart({ items, subtotal, customerId, isFirstOrder, couponCode }) {
  if (!items.length) return { discountAmount: 0, freeShipping: false, allocations: [], appliedPromotions: [], couponError: null };

  const categoryByProduct = await buildCategoryByProduct(items);
  const context = { items, subtotal, customerId, isFirstOrder, categoryByProduct };

  const automaticCandidates = [];
  for (const promotion of await getAutomaticCandidates()) {
    const result = evaluatePromotion(promotion, { ...context, effectiveStartAt: promotion.startAt, effectiveEndAt: promotion.endAt });
    if (result.eligible) automaticCandidates.push({ promotion, eligibleIndexes: result.eligibleIndexes, source: "automatic" });
  }

  let couponError = null;
  let couponCandidate = null;
  let couponResolved = null;
  if (couponCode) {
    const coupon = await findCouponWithPromotion(couponCode);
    if (!coupon || !coupon.promotion) {
      couponError = { code: "COUPON_NOT_FOUND", message: structuredCouponError("COUPON_NOT_FOUND") };
    } else if (coupon.status !== "active" || coupon.promotion.status !== "active") {
      couponError = { code: "COUPON_NOT_ACTIVE", message: structuredCouponError("COUPON_NOT_ACTIVE") };
    } else {
      const preflight = await checkUsagePreflight(coupon, coupon.promotion, customerId);
      const { effectiveStartAt, effectiveEndAt } = effectiveDates(coupon, coupon.promotion);
      const result = !preflight.eligible ? preflight : evaluatePromotion(coupon.promotion, { ...context, effectiveStartAt, effectiveEndAt });
      if (result.eligible) {
        couponCandidate = { promotion: coupon.promotion, eligibleIndexes: result.eligibleIndexes, source: "coupon", coupon };
        couponResolved = coupon;
      } else {
        couponError = { code: result.code, message: result.message || structuredCouponError(result.code) };
      }
    }
  }

  const allCandidates = couponCandidate ? [...automaticCandidates, couponCandidate] : automaticCandidates;
  const selected = resolveStacking(allCandidates);

  const appliedPromotions = [];
  const allocationSets = [];
  let discountAmount = 0;
  let freeShipping = false;

  for (const candidate of selected) {
    const strategy = getStrategy(candidate.promotion.type);
    const result = strategy(candidate.promotion, items, candidate.eligibleIndexes);
    discountAmount += result.discountAmount;
    if (result.freeShipping) freeShipping = true;
    allocationSets.push(result.allocations);
    appliedPromotions.push({
      promotionId: candidate.promotion._id,
      name: candidate.promotion.name,
      type: candidate.promotion.type,
      discountAmount: result.discountAmount,
      freeShipping: result.freeShipping,
      source: candidate.source,
      couponCode: candidate.coupon?.code,
      couponId: candidate.coupon?._id,
    });
  }

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    freeShipping,
    allocations: allocationSets.length ? mergeAllocations(items, allocationSets) : items.map(() => 0),
    appliedPromotions,
    couponError,
    appliedCoupon: couponResolved && appliedPromotions.some((p) => p.source === "coupon")
      ? { couponId: couponResolved._id, promotionId: couponResolved.promotion._id }
      : null,
  };
}

export { fail, structuredCouponError };
