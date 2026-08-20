import Checkout from "../models/Checkout.js";
import Order from "../models/Order.js";
import CouponRedemption from "../models/CouponRedemption.js";
import Address from "../models/Address.js";
import ProductVariant from "../models/ProductVariant.js";
import * as cartService from "./cartService.js";
import * as inventoryService from "./inventoryService.js";
import * as shippingService from "./shippingService.js";
import * as taxService from "./taxService.js";
import * as orderService from "./orderService.js";
import * as promotionEngine from "./promotions/promotionEngine.js";
import * as redemptionService from "./promotions/redemptionService.js";
import { logAuditEvent } from "../utils/auditLog.js";

const CHECKOUT_TTL_MS = 20 * 60 * 1000; // 20 minutes

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function toSnapshot(addr) {
  if (!addr) return undefined;
  return {
    fullName: addr.fullName,
    phone: addr.phone,
    line1: addr.addressLine1 ?? addr.line1,
    line2: addr.addressLine2 ?? addr.line2,
    city: addr.city,
    state: addr.state,
    pincode: addr.postalCode ?? addr.pincode,
  };
}

async function requireOwnedCheckout(checkoutId, userId) {
  const checkout = await Checkout.findOne({ _id: checkoutId, user: userId });
  if (!checkout) fail("Checkout not found", "CHECKOUT_NOT_FOUND", 404);
  return checkout;
}

function assertNotExpired(checkout) {
  if (checkout.status === "expired" || checkout.expiresAt < new Date()) {
    if (checkout.status !== "expired") {
      checkout.status = "expired";
      checkout.save().catch(() => {});
    }
    fail("Your checkout session has expired. Please start checkout again.", "CHECKOUT_EXPIRED", 410);
  }
}

// Runs the full promotion engine (automatic promotions + whatever coupon
// is currently applied) on every pricing pass (rule #87: re-evaluate after
// every cart-affecting mutation), not just when a coupon is entered —
// an automatic promotion's eligibility can change from a shipping-method
// switch or an address change just as much as a coupon's can.
async function recomputePricing(checkout) {
  const subtotal = checkout.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const isFirstOrder = (await Order.countDocuments({ user: checkout.user, paymentStatus: "succeeded" })) === 0;
  const evaluation = await promotionEngine.evaluateCart({
    items: checkout.items.map((i) => ({ product: i.product, variant: i.variant, price: i.unitPrice, quantity: i.quantity })),
    subtotal,
    customerId: checkout.user,
    isFirstOrder,
    couponCode: checkout.couponCode,
  });

  checkout.discountAmount = evaluation.discountAmount;
  checkout.freeShipping = evaluation.freeShipping;
  checkout.appliedPromotions = evaluation.appliedPromotions.map((p) => ({
    promotion: p.promotionId, name: p.name, type: p.type, discountAmount: p.discountAmount, source: p.source,
  }));
  checkout.items.forEach((item, i) => { item.discountAmount = evaluation.allocations[i] || 0; });
  // A previously-applied coupon that no longer validates (expired mid-
  // session, usage exhausted by someone else, cart changed under it) is
  // silently dropped from pricing rather than left half-applied — the
  // frontend's own applyCoupon call is what surfaces couponError to the
  // user; a background recompute (e.g. after changing shipping method)
  // just reflects the coupon's current real eligibility.
  if (checkout.couponCode && evaluation.couponError) checkout.couponCode = undefined;

  const effectiveShippingCost = checkout.freeShipping ? 0 : checkout.shippingCost;
  const { taxAmount } = taxService.calculateTax({
    subtotal: round2(subtotal - checkout.discountAmount),
    shippingCost: effectiveShippingCost,
    shippingAddress: checkout.shippingAddress,
  });
  checkout.taxAmount = taxAmount;
  const total = round2(Math.max(0, subtotal + effectiveShippingCost - checkout.discountAmount + taxAmount));
  checkout.pricing = {
    subtotal: round2(subtotal),
    discount: round2(checkout.discountAmount),
    shipping: round2(effectiveShippingCost),
    tax: round2(taxAmount),
    total,
  };
}

// POST /checkout — creates a session from the customer's current active
// cart. Ownership is derived from the authenticated user, never from a
// cartId/userId in the request body.
export async function createCheckout(userId) {
  const { items } = await cartService.getCartSummary({ userId });
  if (items.length === 0) fail("Your cart is empty", "CART_EMPTY", 400);

  const cart = await cartService.getOrCreateCart({ userId });

  const checkout = await Checkout.create({
    user: userId,
    cart: cart._id,
    items: items.map((i) => ({
      product: i.productId,
      variant: i.variantId,
      sku: i.sku,
      name: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
  });
  await recomputePricing(checkout);
  await checkout.save();
  logAuditEvent("CHECKOUT_CREATED", userId, { checkoutId: String(checkout._id) });
  return checkout;
}

export async function getCheckout(checkoutId, userId) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  return checkout;
}

// Pure — computes issues and refreshes item.unitPrice snapshots in memory,
// but never saves and never touches checkout.status. Used by both the
// public validate endpoint (which does own the save/status) and place-order
// (which must not let a concurrent validate's save race its own atomic
// claim — see placeOrder below for why this had to be split out).
async function computeIssues(checkout) {
  if (checkout.items.length === 0) {
    return [{ code: "CART_EMPTY", message: "Your cart is empty" }];
  }

  const issues = [];
  const variantIds = checkout.items.map((i) => i.variant);
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).populate("product", "status");
  const variantsById = new Map(variants.map((v) => [String(v._id), v]));

  for (const item of checkout.items) {
    const variant = variantsById.get(String(item.variant));
    if (!variant || variant.status !== "active" || variant.visibility !== "public") {
      issues.push({ code: "VARIANT_UNAVAILABLE", itemId: String(item.variant), message: `${item.name} (${item.variantLabel}) is no longer available` });
      continue;
    }
    if (!variant.product || variant.product.status !== "active") {
      issues.push({ code: "PRODUCT_UNAVAILABLE", itemId: String(item.variant), message: `${item.name} is no longer available` });
      continue;
    }
    const { available } = await inventoryService.getAvailability(item.variant);
    if (item.quantity > available) {
      issues.push({
        code: "INSUFFICIENT_STOCK",
        itemId: String(item.variant),
        message: available > 0 ? `Only ${available} of ${item.name} available` : `${item.name} is out of stock`,
      });
    }
    if (variant.price !== item.unitPrice) {
      issues.push({ code: "PRICE_CHANGED", itemId: String(item.variant), message: `The price of ${item.name} has changed` });
      item.unitPrice = variant.price; // refresh the snapshot so the customer sees the real current price
    }
  }
  return issues;
}

// POST /checkout/:id/validate — revalidates every line against LIVE catalog
// + inventory data. Never assumes "valid when the cart page was loaded" is
// still true. Returns structured issues rather than a single error so the
// frontend can point at exactly what's wrong.
export async function validateCheckout(checkoutId, userId) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);

  const issues = await computeIssues(checkout);
  await recomputePricing(checkout);

  if (issues.length > 0) {
    checkout.status = "active"; // needs another look, not ready to proceed
    await checkout.save();
    return { valid: false, issues, checkout };
  }

  checkout.status = "validated";
  await checkout.save();
  return { valid: true, issues: [], checkout };
}

async function resolveAddressInput(userId, input) {
  if (input.addressId) {
    // Ownership check — a customer can never use another customer's saved
    // address by guessing/supplying its id.
    const address = await Address.findOne({ _id: input.addressId, user: userId });
    if (!address) fail("Address not found", "INVALID_ADDRESS", 404);
    return toSnapshot(address);
  }
  const required = ["fullName", "line1", "city", "state", "pincode", "phone"];
  const missing = required.filter((f) => !input[f]);
  if (missing.length) fail(`Address is incomplete: missing ${missing.join(", ")}`, "INVALID_ADDRESS", 400);
  return toSnapshot({ ...input, addressLine1: input.line1, addressLine2: input.line2, postalCode: input.pincode });
}

// PATCH /checkout/:id/shipping-address
export async function setShippingAddress(checkoutId, userId, input) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  checkout.shippingAddress = await resolveAddressInput(userId, input);
  // Address changed → any previously selected shipping method must be
  // reconfirmed (rule: address changes force a shipping recalculation).
  checkout.shippingMethodId = undefined;
  checkout.shippingCost = 0;
  await recomputePricing(checkout);
  await checkout.save();
  return checkout;
}

// PATCH /checkout/:id/billing-address — { sameAsShipping: true } or full address/addressId
export async function setBillingAddress(checkoutId, userId, input) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  if (input.sameAsShipping) {
    checkout.billingSameAsShipping = true;
    checkout.billingAddress = undefined;
  } else {
    checkout.billingSameAsShipping = false;
    checkout.billingAddress = await resolveAddressInput(userId, input);
  }
  await checkout.save();
  return checkout;
}

// GET /checkout/:id/shipping-methods
export async function getShippingMethods(checkoutId, userId) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  return shippingService.getShippingMethods({ subtotal: checkout.pricing.subtotal });
}

// PATCH /checkout/:id/shipping-method — { shippingMethodId }
export async function setShippingMethod(checkoutId, userId, shippingMethodId) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  const method = shippingService.resolveShippingCost(shippingMethodId, { subtotal: checkout.pricing.subtotal });
  checkout.shippingMethodId = method.id;
  checkout.shippingCost = method.cost;
  await recomputePricing(checkout);
  await checkout.save();
  return checkout;
}

// POST /checkout/:id/coupon — { code }. Only validates/applies for display
// — this is NOT redemption (rule #27). The coupon becomes permanently
// consumed only inside placeOrder's atomic redemption step.
export async function applyCoupon(checkoutId, userId, code) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);

  const subtotal = checkout.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const isFirstOrder = (await Order.countDocuments({ user: userId, paymentStatus: "succeeded" })) === 0;
  const evaluation = await promotionEngine.evaluateCart({
    items: checkout.items.map((i) => ({ product: i.product, variant: i.variant, price: i.unitPrice, quantity: i.quantity })),
    subtotal, customerId: userId, isFirstOrder, couponCode: code,
  });
  if (evaluation.couponError) fail(evaluation.couponError.message, evaluation.couponError.code, 400);
  if (!evaluation.appliedPromotions.some((p) => p.source === "coupon")) {
    // Stacking rules dropped it (e.g. an exclusive automatic promotion is
    // already active) even though the code itself is valid.
    fail("This coupon can't be combined with an active offer on your cart", "COUPON_STACKING_NOT_ALLOWED", 400);
  }

  checkout.couponCode = String(code).toUpperCase().trim();
  await recomputePricing(checkout);
  await checkout.save();
  return checkout;
}

// DELETE /checkout/:id/coupon
export async function removeCoupon(checkoutId, userId) {
  const checkout = await requireOwnedCheckout(checkoutId, userId);
  assertNotExpired(checkout);
  checkout.couponCode = undefined;
  await recomputePricing(checkout);
  await checkout.save();
  return checkout;
}

// POST /checkout/:id/place-order — the high-risk operation. Idempotent via
// (a) an atomic status-guarded transition on the Checkout itself (protects
// against the same checkout being submitted twice — double-click, two tabs)
// and (b) an optional client Idempotency-Key stored uniquely on the
// checkout. The underlying per-variant stock race (two DIFFERENT checkouts
// competing for the same last unit) is protected by inventoryService's own
// atomic conditional update — this function doesn't need to re-implement
// that, only avoid processing itself twice.
export async function placeOrder(checkoutId, userId, idempotencyKey, paymentMethod = "online") {
  const existing = await requireOwnedCheckout(checkoutId, userId);

  // Already completed/in-flight — return what already happened instead of
  // creating a second order. Covers retry-after-success and the "network
  // timeout, client retries" case (rule #78).
  if (["inventory_reserved", "payment_pending", "completed"].includes(existing.status) && existing.order) {
    const order = await Order.findById(existing.order);
    return { checkout: existing, order, razorpayOrderId: order?.razorpayOrderId, amount: order ? Math.round(order.totalAmount * 100) : undefined, reused: true };
  }

  assertNotExpired(existing);

  if (!existing.shippingAddress) fail("Please add a shipping address", "INVALID_ADDRESS", 400);
  if (!existing.shippingMethodId) fail("Please select a shipping method", "INVALID_SHIPPING_METHOD", 400);

  // Atomic guard — claim the checkout BEFORE doing any validation. This has
  // to happen first: validation (computeIssues + recomputePricing) mutates
  // and used to save the document independently, and when several identical
  // place-order calls raced, their saves stomped on each other and on this
  // claim, so none of them ever observed a matching {active, validated}
  // status and every call failed with CHECKOUT_IN_PROGRESS. Claiming first
  // means only one caller ever proceeds past this point; every other
  // concurrent caller is turned away right here, before touching validation
  // at all.
  const claimed = await Checkout.findOneAndUpdate(
    { _id: checkoutId, user: userId, status: { $in: ["active", "validated"] } },
    { $set: { status: "inventory_reserved", ...(idempotencyKey ? { idempotencyKey } : {}) } },
    { new: true }
  ).catch((err) => {
    if (err.code === 11000) return null; // idempotencyKey collision — a concurrent identical request already claimed it
    throw err;
  });

  if (!claimed) {
    // Someone else (or a concurrent tab) already claimed this checkout.
    const current = await Checkout.findById(checkoutId);
    if (current?.order) {
      const order = await Order.findById(current.order);
      return { checkout: current, order, razorpayOrderId: order?.razorpayOrderId, reused: true };
    }
    fail("This checkout is already being processed", "CHECKOUT_IN_PROGRESS", 409);
  }

  // Validate against the document we just claimed exclusively — no second
  // independent load/save that a concurrent caller could race against.
  const issues = await computeIssues(claimed);
  await recomputePricing(claimed);
  if (issues.length > 0) {
    claimed.status = "active";
    await claimed.save();
    const err = new Error("Checkout could not be completed — some items changed");
    err.statusCode = 409;
    err.code = "REVALIDATION_FAILED";
    err.issues = issues;
    throw err;
  }

  const billingAddress = claimed.billingSameAsShipping ? claimed.shippingAddress : claimed.billingAddress;

  // Redeem — this is the moment any applied promotion/coupon actually
  // becomes consumed (rule #27), inside the exclusive claim we already
  // hold on this checkout, so nothing else can race it for this checkout.
  // Real usage-limit concurrency (two DIFFERENT checkouts racing for the
  // last use of the SAME coupon) is protected by redemptionService's own
  // atomic conditional update, same shape as inventory's reservation guard.
  const redemptionIds = [];
  try {
    for (const p of claimed.appliedPromotions || []) {
      const redemption = p.source === "coupon"
        ? await redemptionService.redeemCoupon({
            couponId: (await promotionEngine.findCouponWithPromotion(claimed.couponCode))._id,
            promotionId: p.promotion, customerId: userId, checkoutId: claimed._id, discountAmount: p.discountAmount,
          })
        : await redemptionService.redeemAutomaticPromotion({
            promotionId: p.promotion, customerId: userId, checkoutId: claimed._id, discountAmount: p.discountAmount,
          });
      redemptionIds.push(redemption._id);
    }
  } catch (err) {
    await redemptionService.releaseRedemptionsForCheckout(claimed._id);
    await Checkout.updateOne({ _id: checkoutId, status: "inventory_reserved" }, { $set: { status: "active" } });
    throw err;
  }

  let result;
  try {
    result = await orderService.createOrderFromItems({
      userId,
      items: claimed.items.map((i) => ({ product: i.product, variant: i.variant, quantity: i.quantity, discountAmount: i.discountAmount })),
      shippingAddress: claimed.shippingAddress,
      billingAddress,
      shippingMethod: claimed.shippingMethodId,
      shippingCost: claimed.shippingCost,
      discountAmount: claimed.discountAmount,
      taxAmount: claimed.taxAmount,
      couponCode: claimed.couponCode,
      promotionSnapshots: (claimed.appliedPromotions || []).map((p) => ({
        promotion: p.promotion, name: p.name, type: p.type, discountAmount: p.discountAmount, freeShipping: claimed.freeShipping,
      })),
      checkoutId: claimed._id,
      idempotencyKey,
      paymentMethod,
    });
  } catch (err) {
    // Order/reservation failed — release the checkout back to a retryable
    // state instead of leaving it stuck "inventory_reserved" with nothing
    // behind it, and release any redemptions we just claimed (rule #28:
    // a payment/order failure must not permanently consume the coupon).
    await redemptionService.releaseRedemptionsForCheckout(claimed._id);
    await Checkout.updateOne({ _id: checkoutId, status: "inventory_reserved" }, { $set: { status: "active" } });
    throw err;
  }

  // Now that the Order exists, stamp its id onto the redemption rows so a
  // later payment-failure/cancellation can find and release them by order.
  if (redemptionIds.length) {
    await CouponRedemption.updateMany({ _id: { $in: redemptionIds } }, { $set: { order: result.order._id } });
  }

  claimed.order = result.order._id;
  // COD confirms the order (and its own Checkout row) immediately inside
  // paymentService.confirmCodOrder — no online-gateway step remains to
  // wait for, so the checkout is genuinely "completed", not still
  // "payment_pending" (which would incorrectly suggest a payment is
  // outstanding for a COD order that's already confirmed).
  claimed.status = paymentMethod === "cod" ? "completed" : "payment_pending";
  await claimed.save();

  logAuditEvent("CHECKOUT_ORDER_CREATED", userId, { checkoutId: String(claimed._id), orderId: String(result.order._id) });
  return { checkout: claimed, order: result.order, razorpayOrderId: result.razorpayOrderId, amount: result.amount };
}
