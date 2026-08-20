import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import * as inventoryService from "./inventoryService.js";
import * as paymentService from "./paymentService.js";
import { generateOrderNumber } from "../utils/orderNumber.js";
import { recordOrderEvent } from "./orderEventService.js";
import * as eventBus from "./notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";
import { checkoutOutcomeTotal } from "../utils/metrics.js";

function round2(n) {
  return Math.round(n * 100) / 100;
}

// The one place an Order + its Razorpay counterpart + its inventory
// reservation get created — used by both the legacy direct POST /orders
// endpoint and the Checkout session's place-order step, so there is exactly
// one implementation of "resolve items → reserve stock → create Razorpay
// order → roll back cleanly on any failure" rather than two copies that
// could drift apart.
//
// Prices are always re-read from the DB here — client-submitted prices are
// never trusted, since a manipulated request could otherwise create a
// Razorpay order for an arbitrary amount. shippingCost/discountAmount/
// taxAmount are supplied by the CALLER (checkoutService, already computed
// server-side via shippingService/couponService/taxService) — never taken
// from request bodies passed through this far.
export async function createOrderFromItems({
  userId,
  items,
  shippingAddress,
  billingAddress,
  shippingMethod,
  shippingCost = 0,
  discountAmount = 0,
  taxAmount = 0,
  couponCode,
  promotionSnapshots = [],
  checkoutId,
  idempotencyKey,
  paymentMethod = "online",
}) {
  if (!items?.length) throw Object.assign(new Error("Order must contain at least one item"), { statusCode: 400 });

  // Order-creation idempotency (rule #22), independent of Checkout's own
  // atomic claim (Phase 7) — covers the legacy direct-create path too,
  // and is a second guard even on the Checkout path. A retried identical
  // request (same key) gets back the order that already exists rather than
  // a duplicate.
  if (idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey });
    if (existing) {
      return { order: existing, razorpayOrderId: existing.razorpayOrderId, amount: Math.round(existing.totalAmount * 100), reused: true };
    }
  }

  const products = await Product.find({ _id: { $in: items.map((i) => i.product) }, status: "active" });
  const productsById = new Map(products.map((p) => [String(p._id), p]));

  const variantIds = items.map((i) => i.variant).filter(Boolean);
  const variants = variantIds.length
    ? await ProductVariant.find({ _id: { $in: variantIds }, status: "active" })
    : [];
  const variantsById = new Map(variants.map((v) => [String(v._id), v]));

  const resolvedItems = items.map((item) => {
    const product = productsById.get(String(item.product));
    if (!product) throw Object.assign(new Error(`Product not found: ${item.product}`), { statusCode: 400 });

    const quantity = Math.max(1, Number(item.quantity) || 1);
    let price = product.price;
    let sku, variantLabel, variantId;

    if (item.variant) {
      const variant = variantsById.get(String(item.variant));
      if (!variant || String(variant.product) !== String(product._id)) {
        throw Object.assign(new Error(`Variant not found for product: ${item.product}`), { statusCode: 400 });
      }
      price = variant.price;
      sku = variant.sku;
      variantId = variant._id;
      variantLabel = variant.weight?.value ? `${variant.weight.value}${variant.weight.unit}` : item.variantLabel;
    } else if (item.variantLabel) {
      variantLabel = item.variantLabel;
    }

    // Per-line discount allocation (Phase 11) — computed server-side by
    // discountAllocator.js and passed straight through from the caller's
    // already-validated checkout items; never recomputed here from a
    // client-submitted number.
    return { product: product._id, variant: variantId, sku, name: product.name, variantLabel, price, quantity, discountAmount: item.discountAmount || 0 };
  });

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalAmount = round2(Math.max(0, subtotal + shippingCost + taxAmount - discountAmount));
  const orderNumber = await generateOrderNumber();

  // Order row first (status "pending_payment") — gives reservations a
  // stable reference id before the payment provider is ever called.
  const order = await Order.create({
    orderNumber,
    user: userId,
    checkout: checkoutId,
    items: resolvedItems,
    currency: "INR",
    subtotal,
    shippingMethod,
    shippingCost,
    taxAmount,
    discountAmount,
    couponCode,
    couponSnapshot: couponCode ? { code: couponCode, discountAmount } : undefined,
    promotionSnapshots,
    totalAmount,
    shippingAddress,
    billingAddress,
    status: "pending_payment",
    idempotencyKey,
  });
  await recordOrderEvent(order._id, {
    type: "ORDER_CREATED",
    toStatus: "pending_payment",
    actorType: "CUSTOMER",
    actorId: userId,
    message: "Order created from checkout",
  });

  try {
    for (const item of resolvedItems) {
      if (!item.variant) continue;
      await inventoryService.reserveStock({
        variantId: item.variant,
        quantity: item.quantity,
        referenceType: "order",
        referenceId: String(order._id),
      });
    }
  } catch (err) {
    await inventoryService.releaseReservationsForReference("order", String(order._id));
    await Order.deleteOne({ _id: order._id });
    checkoutOutcomeTotal.inc({ outcome: "inventory_failed" });
    throw err;
  }

  let paymentResult;
  try {
    paymentResult = await paymentService.createPaymentForOrder(order, { idempotencyKey, method: paymentMethod === "cod" ? "cod" : undefined });
  } catch (err) {
    await inventoryService.releaseReservationsForReference("order", String(order._id));
    await Order.deleteOne({ _id: order._id });
    checkoutOutcomeTotal.inc({ outcome: "payment_init_failed" });
    throw err;
  }

  order.razorpayOrderId = paymentResult.providerOrderId; // legacy field name, kept for existing frontend/order views
  await order.save();
  checkoutOutcomeTotal.inc({ outcome: "order_created" });

  // Fire-and-forget from the caller's perspective — publish() never throws
  // (rule #156: a notification failure must never break order creation).
  await eventBus.publish(EVENT_TYPES.ORDER_CREATED, { orderId: String(order._id), orderNumber: order.orderNumber, userId: String(userId) }, { source: "order" });

  return { order, razorpayOrderId: paymentResult.providerOrderId, amount: paymentResult.amount, paymentId: paymentResult.payment._id };
}
