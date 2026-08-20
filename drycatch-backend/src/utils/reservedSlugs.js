// System routes a CMS page/blog slug must never collide with (rule #12/
// #175) — checked before create/update, not just at the frontend router
// level, since the backend is the actual authority on what "/foo" means.
export const RESERVED_SLUGS = [
  "admin", "api", "products", "categories", "collections", "cart", "checkout",
  "account", "search", "orders", "wishlist", "login", "signup", "reviews",
  "blog", "preview", "health", "ready",
];

export function isReservedSlug(slug) {
  const first = String(slug).toLowerCase().split("/").filter(Boolean)[0];
  return RESERVED_SLUGS.includes(first);
}
