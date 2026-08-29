// ── Shared in-memory product cache ───────────────────────────────────────
// Cart state elsewhere in the app (AppRoutes) tracks only { [productId]: qty }.
// Components that need full product details for a cart entry (e.g. the
// Navbar's CartDrawer) look them up here instead of a hardcoded mock array.
// Populated opportunistically whenever any page fetches & normalizes a list
// of products (Home, Shop, CategoryPage, ProductDetail) or loads the cart
// itself (cartAPI.get() returns populated product docs).
const cache = new Map();

export function cacheProducts(products = []) {
  for (const p of products) {
    if (p && p.id) cache.set(p.id, p);
  }
}

export function getCachedProduct(id) {
  return cache.get(id);
}
