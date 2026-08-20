import * as checkoutService from "../services/checkoutService.js";

// POST /checkout
export async function postCreateCheckout(req, res) {
  const checkout = await checkoutService.createCheckout(req.user._id);
  res.status(201).json({ checkout });
}

// GET /checkout/:id
export async function getCheckout(req, res) {
  const checkout = await checkoutService.getCheckout(req.params.id, req.user._id);
  res.json({ checkout });
}

// POST /checkout/:id/validate
export async function postValidate(req, res) {
  const result = await checkoutService.validateCheckout(req.params.id, req.user._id);
  res.json(result);
}

// PATCH /checkout/:id/shipping-address — { addressId } or { fullName, line1, line2, city, state, pincode, phone }
export async function patchShippingAddress(req, res) {
  const checkout = await checkoutService.setShippingAddress(req.params.id, req.user._id, req.body);
  res.json({ checkout });
}

// PATCH /checkout/:id/billing-address — { sameAsShipping } or { addressId } or full address
export async function patchBillingAddress(req, res) {
  const checkout = await checkoutService.setBillingAddress(req.params.id, req.user._id, req.body);
  res.json({ checkout });
}

// GET /checkout/:id/shipping-methods
export async function getShippingMethods(req, res) {
  const methods = await checkoutService.getShippingMethods(req.params.id, req.user._id);
  res.json({ methods });
}

// PATCH /checkout/:id/shipping-method — { shippingMethodId }
export async function patchShippingMethod(req, res) {
  const { shippingMethodId } = req.body;
  if (!shippingMethodId) return res.status(400).json({ message: "shippingMethodId is required" });
  const checkout = await checkoutService.setShippingMethod(req.params.id, req.user._id, shippingMethodId);
  res.json({ checkout });
}

// POST /checkout/:id/coupon — { code }
export async function postCoupon(req, res) {
  const { code } = req.body;
  const checkout = await checkoutService.applyCoupon(req.params.id, req.user._id, code);
  res.json({ checkout });
}

// DELETE /checkout/:id/coupon
export async function deleteCoupon(req, res) {
  const checkout = await checkoutService.removeCoupon(req.params.id, req.user._id);
  res.json({ checkout });
}

// POST /checkout/:id/place-order — Idempotency-Key header is optional but
// recommended; also protected regardless via the checkout's own atomic
// status transition (see checkoutService.placeOrder).
const SUPPORTED_PAYMENT_METHODS = ["online", "cod"];

export async function postPlaceOrder(req, res) {
  const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
  const paymentMethod = req.body?.paymentMethod || "online";
  if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: `Unsupported payment method: ${paymentMethod}`, code: "INVALID_PAYMENT_METHOD" });
  }
  const result = await checkoutService.placeOrder(req.params.id, req.user._id, idempotencyKey, paymentMethod);
  res.status(result.reused ? 200 : 201).json(result);
}
