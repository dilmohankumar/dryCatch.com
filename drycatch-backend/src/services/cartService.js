import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import ProductVariant from "../models/ProductVariant.js";
import * as inventoryService from "../services/inventoryService.js";
import { toMinorUnits, fromMinorUnits, sumMinorUnits } from "../utils/money.js";
import { logAuditEvent } from "../utils/auditLog.js";

export const MAX_ITEM_QUANTITY = 50;
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cartFilter({ userId, guestId }) {
  if (userId) return { user: userId, status: "active" };
  return { guestId, status: "active" };
}

// Atomic upsert — the unique partial index on Cart (user+status /
// guestId+status) is what actually prevents two concurrent requests from
// creating two active carts for the same identity; this just wraps that in
// a friendly upsert-or-fetch.
export async function getOrCreateCart(identity) {
  const filter = cartFilter(identity);
  const setOnInsert = { ...filter };
  if (identity.guestId) setOnInsert.expiresAt = new Date(Date.now() + GUEST_CART_TTL_MS);

  try {
    return await Cart.findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, { new: true, upsert: true });
  } catch (err) {
    if (err.code === 11000) return Cart.findOne(filter); // lost an upsert race — just read what won
    throw err;
  }
}

async function requireActiveVariant(variantId) {
  const variant = await ProductVariant.findOne({ _id: variantId, status: "active", visibility: "public" }).populate({
    path: "product",
    select: "name slug status visibility",
  });
  if (!variant) {
    throw Object.assign(new Error("This item is no longer available"), { statusCode: 409, code: "VARIANT_UNAVAILABLE" });
  }
  if (!variant.product || variant.product.status !== "active") {
    throw Object.assign(new Error("This product is no longer available"), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
  }
  return variant;
}

function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Object.assign(new Error("Quantity must be a positive whole number"), { statusCode: 400, code: "INVALID_QUANTITY" });
  }
  if (quantity > MAX_ITEM_QUANTITY) {
    throw Object.assign(new Error(`Maximum quantity per item is ${MAX_ITEM_QUANTITY}`), { statusCode: 400, code: "MAX_QUANTITY_EXCEEDED" });
  }
}

// POST /cart/items semantics: ADD `quantity` to whatever is already there
// (0 if new). Concurrency-safe via a single atomic $inc — two simultaneous
// "+1" requests against the same line produce +2 total, never a lost update
// and never a duplicate line (the unique {cart, variant} index guarantees
// that; a create-race is retried as an increment on the doc that won).
export async function addItem(identity, { variantId, quantity = 1 }) {
  validateQuantity(quantity);
  const variant = await requireActiveVariant(variantId);
  const cart = await getOrCreateCart(identity);

  const existing = await CartItem.findOne({ cart: cart._id, variant: variantId });
  const requestedTotal = (existing?.quantity || 0) + quantity;
  if (requestedTotal > MAX_ITEM_QUANTITY) {
    throw Object.assign(new Error(`Maximum quantity per item is ${MAX_ITEM_QUANTITY}`), { statusCode: 400, code: "MAX_QUANTITY_EXCEEDED" });
  }

  const { available } = await inventoryService.getAvailability(variantId);
  if (requestedTotal > available) {
    throw Object.assign(
      new Error(available > 0 ? `Only ${available} available` : "This item is out of stock"),
      { statusCode: 409, code: "INSUFFICIENT_STOCK" }
    );
  }

  let item;
  try {
    item = await CartItem.findOneAndUpdate(
      { cart: cart._id, variant: variantId },
      { $inc: { quantity }, $setOnInsert: { priceSnapshot: variant.price } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lost the upsert race to a concurrent identical add — the doc exists
    // now, so retry as a plain increment.
    item = await CartItem.findOneAndUpdate({ cart: cart._id, variant: variantId }, { $inc: { quantity } }, { new: true });
  }

  logAuditEvent("CART_ITEM_ADDED", identity.userId, { cartId: String(cart._id), variantId, quantity });
  return item;
}

// PATCH /cart/items/:itemId semantics: SET quantity to the given value.
export async function updateItem(identity, itemId, quantity) {
  validateQuantity(quantity);
  const cart = await getOrCreateCart(identity);
  const item = await CartItem.findOne({ _id: itemId, cart: cart._id });
  if (!item) throw Object.assign(new Error("Item not in cart"), { statusCode: 404, code: "CART_ITEM_NOT_FOUND" });

  const { available } = await inventoryService.getAvailability(item.variant);
  if (quantity > available) {
    throw Object.assign(
      new Error(available > 0 ? `Only ${available} available` : "This item is out of stock"),
      { statusCode: 409, code: "INSUFFICIENT_STOCK" }
    );
  }

  item.quantity = quantity;
  await item.save();
  logAuditEvent("CART_ITEM_UPDATED", identity.userId, { cartId: String(cart._id), itemId, quantity });
  return item;
}

export async function removeItem(identity, itemId) {
  const cart = await getOrCreateCart(identity);
  const item = await CartItem.findOneAndDelete({ _id: itemId, cart: cart._id });
  if (item) logAuditEvent("CART_ITEM_REMOVED", identity.userId, { cartId: String(cart._id), itemId });
  return item;
}

export async function clearCart(identity) {
  const cart = await getOrCreateCart(identity);
  await CartItem.deleteMany({ cart: cart._id });
}

// Enriches raw cart lines with live catalog/inventory data and computes the
// subtotal server-side, in integer paise, from data the client never
// supplied — the frontend never gets to submit or influence a price/total.
export async function getCartSummary(identity) {
  const cart = await getOrCreateCart(identity);
  const items = await CartItem.find({ cart: cart._id }).populate({
    path: "variant",
    populate: { path: "product", select: "name slug status visibility media slides" },
  });

  const availabilityByVariant = new Map(
    await Promise.all(
      items.map(async (item) => [String(item.variant?._id), item.variant ? await inventoryService.getAvailability(item.variant._id) : null])
    )
  );

  let subtotalMinor = 0;
  const enrichedItems = items.map((item) => {
    const variant = item.variant;
    const product = variant?.product;
    const gone = !variant || !product || product.status !== "active" || variant.status !== "active";

    let availability = "PRODUCT_UNAVAILABLE";
    let lineSubtotal = 0;
    let unitPrice = item.priceSnapshot ?? 0;

    if (!gone) {
      unitPrice = variant.price;
      const stock = availabilityByVariant.get(String(variant._id));
      const available = stock?.available ?? 0;
      if (available <= 0) availability = "OUT_OF_STOCK";
      else if (item.quantity > available) availability = "INSUFFICIENT_STOCK";
      else if (stock.status === "low_stock") availability = "LOW_STOCK";
      else availability = "IN_STOCK";

      if (availability !== "OUT_OF_STOCK") {
        const lineMinor = toMinorUnits(unitPrice) * item.quantity;
        lineSubtotal = fromMinorUnits(lineMinor);
        subtotalMinor += lineMinor;
      }
    }

    return {
      id: item._id,
      variantId: variant?._id,
      productId: product?._id,
      productName: product?.name ?? "Unavailable item",
      productSlug: product?.slug,
      variantLabel: variant?.weight?.value ? `${variant.weight.value}${variant.weight.unit}` : undefined,
      sku: variant?.sku,
      image: product?.media?.[0]?.url || product?.slides?.[0],
      quantity: item.quantity,
      unitPrice,
      priceChanged: !gone && item.priceSnapshot != null && item.priceSnapshot !== variant.price,
      lineSubtotal,
      availability,
      maxAvailable: availabilityByVariant.get(String(variant?._id))?.available ?? 0,
    };
  });

  return {
    cartId: cart._id,
    items: enrichedItems,
    summary: {
      subtotal: fromMinorUnits(subtotalMinor),
      discount: 0, // future Coupons/Pricing phase — clean zero until then, never faked
      tax: 0, // future Tax service
      shipping: null, // future Checkout/shipping — not estimable in Cart
      total: fromMinorUnits(subtotalMinor),
      currency: cart.currency,
    },
  };
}

// Idempotent: called once per successful login. If the guest cart is
// already converted (a retried login/duplicate call), there's nothing left
// with status "active" to find, so this is a safe no-op on repeat calls.
export async function mergeGuestCartIntoUser(guestId, userId) {
  if (!guestId) return null;
  const guestCart = await Cart.findOne({ guestId, status: "active" });
  if (!guestCart) return null;

  const guestItems = await CartItem.find({ cart: guestCart._id });
  if (guestItems.length === 0) {
    guestCart.status = "converted";
    await guestCart.save();
    return null;
  }

  const userCart = await getOrCreateCart({ userId });

  for (const guestItem of guestItems) {
    const existing = await CartItem.findOne({ cart: userCart._id, variant: guestItem.variant });
    const combined = (existing?.quantity || 0) + guestItem.quantity;

    // Merge conflict rule: cap at what's actually available rather than
    // silently producing an unpurchasable cart line.
    const { available } = await inventoryService.getAvailability(guestItem.variant);
    const finalQuantity = Math.max(1, Math.min(combined, available, MAX_ITEM_QUANTITY));

    if (finalQuantity <= 0) continue;

    await CartItem.findOneAndUpdate(
      { cart: userCart._id, variant: guestItem.variant },
      { $set: { quantity: finalQuantity }, $setOnInsert: { priceSnapshot: guestItem.priceSnapshot } },
      { upsert: true, setDefaultsOnInsert: true }
    ).catch((err) => { if (err.code !== 11000) throw err; });
  }

  guestCart.status = "converted";
  await guestCart.save();
  await CartItem.deleteMany({ cart: guestCart._id });

  logAuditEvent("CART_MERGED", userId, { guestCartId: String(guestCart._id), userCartId: String(userCart._id), itemCount: guestItems.length });
  return userCart;
}
