import api from "./api";

export async function fetchOrders({ page = 1, limit = 20, status, search } = {}) {
  const { data } = await api.get("/orders/my-orders", { params: { page, limit, status, search } });
  return data; // { orders, page, limit, total, totalPages }
}

export async function fetchOrderById(id) {
  const { data } = await api.get(`/orders/${id}`);
  return data.order;
}

export async function fetchOrderTimeline(id) {
  const { data } = await api.get(`/orders/${id}/timeline`);
  return data;
}

export async function cancelOrder(id) {
  const { data } = await api.put(`/orders/${id}/cancel`);
  return data.order;
}

export async function verifyPayment({ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const { data } = await api.post("/orders/verify", {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  return data; // { order, paymentStatus }
}

export async function retryPayment(orderId, idempotencyKey) {
  const { data } = await api.post(
    `/orders/${orderId}/retry-payment`,
    {},
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
  );
  return data; // { razorpayOrderId, amount, reused }
}

export async function getPaymentStatus(orderId) {
  const { data } = await api.get(`/orders/${orderId}/payment-status`);
  return data; // { orderStatus, paymentStatus }
}
