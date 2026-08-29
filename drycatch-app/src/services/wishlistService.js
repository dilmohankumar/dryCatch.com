import api from "./api";
import { mapProduct } from "./productService";

export async function fetchWishlist() {
  const { data } = await api.get("/wishlist");
  return data.wishlist.map(mapProduct);
}

export async function addToWishlist(productId) {
  const { data } = await api.post("/wishlist/add", { productId });
  return data.wishlist.map(mapProduct);
}

export async function removeFromWishlist(productId) {
  const { data } = await api.delete(`/wishlist/${productId}`);
  return data.wishlist.map(mapProduct);
}
