import api from "./api";

export async function createCheckout() {
  const { data } = await api.post("/checkout");
  return data.checkout;
}

export async function getCheckout(id) {
  const { data } = await api.get(`/checkout/${id}`);
  return data.checkout;
}

export async function setShippingAddress(id, payload) {
  const { data } = await api.patch(`/checkout/${id}/shipping-address`, payload);
  return data.checkout;
}

export async function setBillingAddress(id, payload) {
  const { data } = await api.patch(`/checkout/${id}/billing-address`, payload);
  return data.checkout;
}

export async function getShippingMethods(id) {
  const { data } = await api.get(`/checkout/${id}/shipping-methods`);
  return data.methods;
}

export async function setShippingMethod(id, shippingMethodId) {
  const { data } = await api.patch(`/checkout/${id}/shipping-method`, { shippingMethodId });
  return data.checkout;
}

export async function applyCoupon(id, code) {
  const { data } = await api.post(`/checkout/${id}/coupon`, { code });
  return data.checkout;
}

export async function removeCoupon(id) {
  const { data } = await api.delete(`/checkout/${id}/coupon`);
  return data.checkout;
}

export async function placeOrder(id, { paymentMethod = "online", idempotencyKey } = {}) {
  const { data } = await api.post(
    `/checkout/${id}/place-order`,
    { paymentMethod },
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
  );
  return data; // { checkout, order, razorpayOrderId?, amount? }
}
