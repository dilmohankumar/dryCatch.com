import * as cartService from "../services/cartService.js";

// GET /cart — always revalidates availability/pricing live, never trusts a
// stored total (see cartService.getCartSummary).
export async function getCart(req, res) {
  const cart = await cartService.getCartSummary(req.cartIdentity);
  res.json({ success: true, data: cart });
}

// POST /cart/items — { variantId, quantity } — ADDS to existing quantity.
export async function postAddItem(req, res) {
  const { variantId, quantity } = req.body;
  if (!variantId) return res.status(400).json({ message: "variantId is required" });
  // `quantity ?? 1`, not `|| 1` — an explicit 0 (or a negative number) must
  // reach validateQuantity() and be rejected, not silently become 1.
  const requestedQuantity = quantity === undefined ? 1 : Number(quantity);
  await cartService.addItem(req.cartIdentity, { variantId, quantity: requestedQuantity });
  const cart = await cartService.getCartSummary(req.cartIdentity);
  res.status(201).json({ success: true, data: cart });
}

// PATCH /cart/items/:itemId — { quantity } — SETS the absolute quantity.
export async function patchItem(req, res) {
  const { quantity } = req.body;
  await cartService.updateItem(req.cartIdentity, req.params.itemId, Number(quantity));
  const cart = await cartService.getCartSummary(req.cartIdentity);
  res.json({ success: true, data: cart });
}

// DELETE /cart/items/:itemId
export async function deleteItem(req, res) {
  const item = await cartService.removeItem(req.cartIdentity, req.params.itemId);
  if (!item) return res.status(404).json({ message: "Item not in cart" });
  const cart = await cartService.getCartSummary(req.cartIdentity);
  res.json({ success: true, data: cart });
}

// DELETE /cart
export async function deleteCart(req, res) {
  await cartService.clearCart(req.cartIdentity);
  const cart = await cartService.getCartSummary(req.cartIdentity);
  res.json({ success: true, data: cart });
}
