import api from "./api";

// Cart requires a logged-in user in this app (the backend's guest-cart path
// relies on an httpOnly cookie, which a bare RN fetch/axios client can't
// carry the way a browser does) — every call here assumes an Authorization
// header is already attached by the api.js interceptor.
export async function fetchCart() {
  const { data } = await api.get("/cart");
  return data.data;
}

export async function addCartItem({ variantId, quantity = 1 }) {
  const { data } = await api.post("/cart/items", { variantId, quantity });
  return data.data;
}

export async function updateCartItem({ itemId, quantity }) {
  const { data } = await api.patch(`/cart/items/${itemId}`, { quantity });
  return data.data;
}

export async function removeCartItem({ itemId }) {
  const { data } = await api.delete(`/cart/items/${itemId}`);
  return data.data;
}

export async function clearCart() {
  const { data } = await api.delete("/cart");
  return data.data;
}
