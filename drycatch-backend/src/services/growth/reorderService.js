import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import ProductVariant from "../../models/ProductVariant.js";
import * as inventoryService from "../inventoryService.js";
import * as cartService from "../cartService.js";

// Phase 24 — "Buy Again" (rule #23). Deliberately does NOT just re-add
// the exact historical line items — price, availability, and even the
// variant itself may no longer be valid (rule #23's explicit "validate
// current price, availability, variant existence, inventory... before
// adding items to cart"). Returns a per-item verdict so the frontend can
// show "3 of 4 items added, 1 no longer available" instead of silently
// dropping something or failing the whole action.
export async function getReorderPreview(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404, code: "ORDER_NOT_FOUND" });
  }

  const results = [];
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (!product || product.status !== "active" || product.visibility !== "public") {
      results.push({ productId: item.product, name: item.name, available: false, reason: "PRODUCT_UNAVAILABLE" });
      continue;
    }

    const variant = item.variant
      ? await ProductVariant.findOne({ _id: item.variant, product: product._id, status: "active" })
      : await ProductVariant.findOne({ product: product._id, isDefault: true, status: "active" });

    if (!variant) {
      results.push({ productId: item.product, name: product.name, available: false, reason: "VARIANT_UNAVAILABLE" });
      continue;
    }

    const availability = await inventoryService.getAvailability(variant._id);
    if (availability.available <= 0) {
      results.push({ productId: item.product, variantId: variant._id, name: product.name, available: false, reason: "OUT_OF_STOCK" });
      continue;
    }

    results.push({
      productId: item.product,
      variantId: variant._id,
      name: product.name,
      available: true,
      quantity: item.quantity,
      currentPrice: variant.price, // deliberately the CURRENT price, never the historical order price (rule #23/#60 — checkout always prices server-side, at add-to-cart time too)
      priceChanged: variant.price !== item.price,
    });
  }

  return { orderId: order._id, orderNumber: order.orderNumber, items: results };
}

// Adds every currently-available item from the preview to the cart via
// the real cart service (rule #23) — never bypasses cartService's own
// price/stock validation, since "available" here only reflects the
// moment the preview was computed a request ago.
export async function reorder(orderId, userId, cartIdentity) {
  const preview = await getReorderPreview(orderId, userId);
  const added = [];
  const skipped = [];
  for (const item of preview.items) {
    if (!item.available) {
      skipped.push({ productId: item.productId, name: item.name, reason: item.reason });
      continue;
    }
    try {
      await cartService.addItem(cartIdentity, { variantId: item.variantId, quantity: item.quantity });
      added.push({ productId: item.productId, name: item.name, quantity: item.quantity });
    } catch (err) {
      skipped.push({ productId: item.productId, name: item.name, reason: err.code || "ADD_TO_CART_FAILED" });
    }
  }
  return { added, skipped };
}
