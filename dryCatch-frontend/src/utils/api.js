const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

// Auth tokens live in httpOnly cookies set by the backend (never readable
// from JS) — `credentials: "include"` sends/receives them on every request,
// there is no Authorization header to attach client-side anymore.
async function rawRequest(path, options = {}) {
  // `...options` must come BEFORE `headers`, not after — any caller that
  // passes its own `options.headers` (e.g. checkoutAPI.placeOrder's
  // Idempotency-Key) would otherwise have its headers object completely
  // replace this one (object spread applies in order), silently dropping
  // Content-Type. Without it, fetch sends a stringified-JSON body as
  // `text/plain`, which Express's json() body-parser never parses —
  // `req.body` ends up empty server-side with no error, no matter what
  // the caller actually sent (this is exactly how a real bug shipped:
  // POST /checkout/:id/place-order's `paymentMethod` silently reached the
  // server as `undefined` every time an Idempotency-Key header was set).
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "API Error");
    err.status = res.status;
    err.code = data.code; // structured error code, e.g. COUPON_MINIMUM_ORDER_NOT_MET
    err.issues = data.issues;
    throw err;
  }
  return data;
}

// Endpoints where a 401 means "these credentials are wrong", not "the access
// token expired" — retrying via refresh would just mask the real error.
const NO_REFRESH_RETRY = ["/auth/login", "/auth/signup", "/auth/refresh-token"];

async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (err) {
    const skipRetry = NO_REFRESH_RETRY.some((p) => path.startsWith(p));
    if (err.status !== 401 || skipRetry) throw err;

    // Access token cookie expired — try the refresh cookie once, then retry.
    try {
      await rawRequest("/auth/refresh-token", { method: "POST" });
    } catch {
      throw err;
    }
    return rawRequest(path, options);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════
// Builds a query string from a params object, dropping empty/undefined
// values and joining array values as comma lists (matches the backend's
// whitelisted-filter parsing in productService.js).
function toQueryString(params = {}) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const productsAPI = {
  // params: { category, collection, tag, origin, minPrice, maxPrice, sort, page, limit, search, featured }
  getAll: (params = {}) => request(`/products${toQueryString(params)}`),
  getById: (idOrSlug) => request(`/products/${idOrSlug}`),
  getFeatured: () => request("/products/featured"),
  getByCategory: (categoryId) => request(`/products/category/${categoryId}`),
  create: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/products/${id}`, { method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════
// COLLECTIONS (merchandising groupings — distinct from taxonomy categories)
// ═══════════════════════════════════════════════════════════════════
export const collectionsAPI = {
  getAll: () => request("/collections"),
  getBySlug: (slug) => request(`/collections/${slug}`),
  create: (data) => request("/collections", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/collections/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/collections/${id}`, { method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════
// PRODUCT VARIANTS (the purchasable unit — see docs/database.md)
// ═══════════════════════════════════════════════════════════════════
export const variantsAPI = {
  getAll: (productId) => request(`/products/${productId}/variants`),
  getById: (productId, variantId) => request(`/products/${productId}/variants/${variantId}`),
  create: (productId, data) => request(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  update: (productId, variantId, data) => request(`/products/${productId}/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (productId, variantId) => request(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
  // Customer-safe: { available: boolean, status: "in_stock"|"low_stock"|"out_of_stock" }
  // — never exposes on-hand/reserved counts or warehouse data.
  getAvailability: (productId, variantId) => request(`/products/${productId}/variants/${variantId}/availability`),
};

// ═══════════════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════════════
// Cart works for guests (an httpOnly guest-cart cookie, set automatically by
// the backend) and logged-in users alike — no separate guest-cart client
// logic needed here, `credentials:"include"` carries whichever identity
// applies. Server is authoritative for price/subtotal/availability; the
// client only ever sends { variantId, quantity }.
export const cartAPI = {
  get: () => request("/cart"),
  addItem: (variantId, quantity = 1) =>
    request("/cart/items", { method: "POST", body: JSON.stringify({ variantId, quantity }) }),
  setItemQuantity: (itemId, quantity) =>
    request(`/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  removeItem: (itemId) => request(`/cart/items/${itemId}`, { method: "DELETE" }),
  clear: () => request("/cart", { method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════
export const ordersAPI = {
  create: (data) =>
    request("/orders", { method: "POST", body: JSON.stringify(data) }),
  // params: { page, limit, status, search } — list view returns lightweight
  // summary DTOs, not full orders (see docs/orders.md).
  getMyOrders: (params = {}) => request(`/orders/my-orders${toQueryString(params)}`),
  getById: (id) => request(`/orders/${id}`),
  // GET /orders/:id/timeline — { orderNumber, events: [{type, fromStatus,
  // toStatus, message, actorType, createdAt}] }, backend-authoritative.
  getOrderTimeline: (id) => request(`/orders/${id}/timeline`),
  cancel: (id) =>
    request(`/orders/${id}/cancel`, { method: "PUT", body: JSON.stringify({}) }),
  getAll: () => request("/orders"), // Admin
  updateStatus: (id, status) =>
    request(`/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  // POST /orders/verify — { orderId, razorpay_order_id, razorpay_payment_id,
  // razorpay_signature }, called from the Razorpay success handler after
  // checkout's place-order step created the order + Razorpay order.
  verifyPayment: (payload) =>
    request("/orders/verify", { method: "POST", body: JSON.stringify(payload) }),
  // POST /orders/:id/retry-payment — used when a payment attempt fails or
  // the Razorpay modal is dismissed/times out; the order + reservation
  // already exist, this just opens a fresh provider order for a new
  // attempt. idempotencyKey: a fresh UUID per retry click.
  retryPayment: (orderId, idempotencyKey) =>
    request(`/orders/${orderId}/retry-payment`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({}),
    }),
  // GET /orders/:id/payment-status — { orderStatus, paymentStatus }, for
  // polling during/after a Razorpay callback instead of assuming success
  // or failure the instant the client-side flow returns.
  getPaymentStatus: (orderId) => request(`/orders/${orderId}/payment-status`),
};

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT (Phase 7) — a short-lived, server-owned session between Cart
// and Order. The client only ever sends identifiers (addressId,
// shippingMethodId, code) and reads back server-computed pricing; nothing
// here is ever trusted as a price/cost/total. See docs/checkout.md.
// ═══════════════════════════════════════════════════════════════════
export const checkoutAPI = {
  create: () => request("/checkout", { method: "POST" }),
  get: (id) => request(`/checkout/${id}`),
  validate: (id) => request(`/checkout/${id}/validate`, { method: "POST" }),
  // payload: { addressId } or a full address object
  setShippingAddress: (id, payload) =>
    request(`/checkout/${id}/shipping-address`, { method: "PATCH", body: JSON.stringify(payload) }),
  // payload: { sameAsShipping: true } or { addressId } or a full address object
  setBillingAddress: (id, payload) =>
    request(`/checkout/${id}/billing-address`, { method: "PATCH", body: JSON.stringify(payload) }),
  getShippingMethods: (id) => request(`/checkout/${id}/shipping-methods`),
  setShippingMethod: (id, shippingMethodId) =>
    request(`/checkout/${id}/shipping-method`, { method: "PATCH", body: JSON.stringify({ shippingMethodId }) }),
  applyCoupon: (id, code) =>
    request(`/checkout/${id}/coupon`, { method: "POST", body: JSON.stringify({ code }) }),
  removeCoupon: (id) => request(`/checkout/${id}/coupon`, { method: "DELETE" }),
  // idempotencyKey: a UUID generated once per checkout attempt on the
  // client and re-sent unchanged on any retry of that same attempt.
  // paymentMethod: "online" (default, opens Razorpay) or "cod" (backend
  // confirms the order immediately, no gateway involved).
  placeOrder: (id, idempotencyKey, paymentMethod = "online") =>
    request(`/checkout/${id}/place-order`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ paymentMethod }),
    }),
};

// ═══════════════════════════════════════════════════════════════════
// SHIPMENTS (Phase 10) — customer-facing tracking, ownership-checked
// server-side via the order. See docs/shipping.md.
// ═══════════════════════════════════════════════════════════════════
export const shipmentAPI = {
  // GET /orders/:orderId/shipments — { shipments: [...] }; empty array is
  // normal for an order that hasn't shipped yet, not an error.
  getOrderShipments: (orderId) => request(`/orders/${orderId}/shipments`),
  // GET /shipments/:id/tracking — shipment summary + { events: [...] }
  // (full history, ascending time order). Fetched on demand, not eagerly.
  getShipmentTracking: (shipmentId) => request(`/shipments/${shipmentId}/tracking`),
};

// ═══════════════════════════════════════════════════════════════════
// WISHLIST
// ═══════════════════════════════════════════════════════════════════
export const wishlistAPI = {
  get: () => request("/wishlist"),
  add: (productId) =>
    request("/wishlist/add", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),
  remove: (productId) => request(`/wishlist/${productId}`, { method: "DELETE" }),
  clear: () => request("/wishlist", { method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════
// REVIEWS (Phase 12) — the backend is the sole authority on verification,
// publication status, and the product's aggregate rating; nothing here is
// ever trusted from the client. See docs/reviews.md.
// ═══════════════════════════════════════════════════════════════════
export const reviewAPI = {
  // params: { sort, rating, verifiedOnly, hasPhotos, page, limit }
  // sort: newest | highest_rating | lowest_rating | most_helpful
  getByProduct: (productId, params = {}) =>
    request(`/products/${productId}/reviews${toQueryString(params)}`),
  // { averageRating, reviewCount, ratingDistribution: {1..5}, verifiedReviewCount, photoReviewCount }
  getSummary: (productId) => request(`/products/${productId}/reviews/summary`),
  // { rating, title, body, variantId?, media? } — can fail with
  // REVIEW_NOT_ELIGIBLE / ALREADY_REVIEWED / INVALID_RATING (err.code).
  create: (productId, data) =>
    request(`/products/${productId}/reviews`, { method: "POST", body: JSON.stringify(data) }),
  // Customer's own review history (pending/published/rejected, not deleted).
  getMyReviews: (params = {}) => request(`/reviews/my${toQueryString(params)}`),
  // Public if published; owner sees their own regardless of status.
  getById: (id) => request(`/reviews/${id}`),
  update: (id, data) => request(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/reviews/${id}`, { method: "DELETE" }),
  // vote: "helpful" | "not_helpful" — can fail with REVIEW_NOT_OWNER / REVIEW_NOT_PUBLISHED.
  vote: (id, vote) => request(`/reviews/${id}/vote`, { method: "POST", body: JSON.stringify({ vote }) }),
  removeVote: (id) => request(`/reviews/${id}/vote`, { method: "DELETE" }),
  // reason: spam | offensive | fake_review | irrelevant | abusive | other
  report: (id, data) => request(`/reviews/${id}/report`, { method: "POST", body: JSON.stringify(data) }),
};

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════
export const categoriesAPI = {
  getAll: () => request("/categories"),
  getTree: () => request("/categories/tree"),
  getById: (id) => request(`/categories/${id}`),
  create: (data) =>
    request("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/categories/${id}`, { method: "DELETE" }),
};

// ═══════════════════════════════════════════════════════════════════
// AUTH (signup/login/otp/reset — merged in from the former utils/auth.js,
// which duplicated this same fetch wrapper with a slightly different shape)
// ═══════════════════════════════════════════════════════════════════
export const authAPI = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  verifyOtp: (payload) =>
    request("/auth/signup/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  requestPasswordReset: (payload) =>
    request("/auth/password-reset/request", { method: "POST", body: JSON.stringify(payload) }),
  resetPassword: (payload) =>
    request("/auth/password-reset/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
};

// ═══════════════════════════════════════════════════════════════════
// USER PROFILE & ACCOUNT
// ═══════════════════════════════════════════════════════════════════
export const userAPI = {
  getMe: () => request("/auth/me"),
  updateProfile: (data) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (data) =>
    request("/auth/change-password", { method: "PUT", body: JSON.stringify(data) }),
  deactivate: (data) =>
    request("/auth/deactivate", { method: "POST", body: JSON.stringify(data) }),
  revokeOtherSessions: () =>
    request("/auth/sessions/revoke-others", { method: "POST", body: JSON.stringify({}) }),
  logout: () => request("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
};

// ═══════════════════════════════════════════════════════════════════
// ADDRESSES (own resource — /api/v1/addresses, ownership enforced server-side)
// ═══════════════════════════════════════════════════════════════════
export const addressAPI = {
  getAll: () => request("/addresses"),
  getById: (id) => request(`/addresses/${id}`),
  create: (data) => request("/addresses", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/addresses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/addresses/${id}`, { method: "DELETE" }),
  setDefault: (id, type = "both") =>
    request(`/addresses/${id}/default`, { method: "PATCH", body: JSON.stringify({ type }) }),
};

// ═══════════════════════════════════════════════════════════════════
// PREFERENCES (notifications/marketing — /api/v1/preferences)
// ═══════════════════════════════════════════════════════════════════
export const preferencesAPI = {
  get: () => request("/preferences"),
  update: (data) => request("/preferences", { method: "PATCH", body: JSON.stringify(data) }),
};

// ═══════════════════════════════════════════════════════════════════
// SEARCH (Phase 13) — read-optimized ProductSearchIndex, not Product itself.
// See docs/search.md. Public endpoints, credentials still included per this
// file's convention (a logged-in customerId, if any, rides along on the
// cookie and feeds search analytics server-side).
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ADMIN — RBAC dashboard/roles/admin-users/customers/audit-log (Phase 14).
// Every route here requires an authenticated admin (role:"admin") and most
// also require a specific permission — a 403 with code "PERMISSION_DENIED"
// is expected and handled by the calling page, not treated as a crash.
// See docs/admin.md.
// ═══════════════════════════════════════════════════════════════════
export const dashboardAPI = {
  // range: today | yesterday | 7d | 30d | 90d
  get: (range = "7d") => request(`/admin/dashboard${toQueryString({ range })}`),
};

export const rolesAPI = {
  getAll: () => request("/admin/roles"),
  create: (data) => request("/admin/roles", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/admin/roles/${id}`, { method: "DELETE" }),
};

export const adminUsersAPI = {
  getAll: (params = {}) => request(`/admin/admin-users${toQueryString(params)}`),
  invite: (data) => request("/admin/admin-users/invite", { method: "POST", body: JSON.stringify(data) }),
  updateRole: (id, roleId) =>
    request(`/admin/admin-users/${id}/role`, { method: "PATCH", body: JSON.stringify({ roleId }) }),
  deactivate: (id) => request(`/admin/admin-users/${id}/deactivate`, { method: "POST", body: JSON.stringify({}) }),
};

export const adminCustomersAPI = {
  // params: { search, status, page, limit }
  getAll: (params = {}) => request(`/admin/customers${toQueryString(params)}`),
  block: (id, reason) =>
    request(`/admin/customers/${id}/block`, { method: "POST", body: JSON.stringify({ reason }) }),
  unblock: (id) => request(`/admin/customers/${id}/unblock`, { method: "POST", body: JSON.stringify({}) }),
};

export const auditLogAPI = {
  // params: { actor, action, entityType, entityId, page, limit }
  getAll: (params = {}) => request(`/admin/audit-logs${toQueryString(params)}`),
};

// ═══════════════════════════════════════════════════════════════════
// CONTENT (Phase 15 — headless CMS, public storefront-facing endpoints).
// No auth required; blocks come back with commerce references already
// resolved server-side (see docs/cms.md) except where noted per-block.
// ═══════════════════════════════════════════════════════════════════
export const contentAPI = {
  getHomepage: () => request("/content/homepage"),
  getPage: (slug) => request(`/content/pages/${slug}`),
  getBlogPost: (slug) => request(`/content/blog/${slug}`),
  // params: { category, tag, page, limit }
  getBlogPosts: (params = {}) => request(`/content/blog${toQueryString(params)}`),
  getFAQs: (category) => request(`/content/faqs${toQueryString({ category })}`),
  getNavigation: (name) => request(`/content/navigation/${name}`),
  getFooter: () => request("/content/footer"),
  // params: { target, targetId }
  getBanners: (params = {}) => request(`/content/banners${toQueryString(params)}`),
  // Fire-and-forget — call sites never await these before rendering/navigating.
  trackBannerImpression: (id) => request(`/content/banners/${id}/impression`, { method: "POST" }),
  trackBannerClick: (id) => request(`/content/banners/${id}/click`, { method: "POST" }),
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN CMS (Phase 15) — auth + cms.* permission required. A 403 with
// code "PERMISSION_DENIED" is expected and handled by the calling page,
// same convention as the rest of /admin (docs/cms.md).
// ═══════════════════════════════════════════════════════════════════
export const cmsPagesAPI = {
  getAll: (params = {}) => request(`/admin/cms/pages${toQueryString(params)}`),
  getHomepage: () => request("/admin/cms/pages/homepage"),
  getById: (id) => request(`/admin/cms/pages/${id}`),
  create: (data) => request("/admin/cms/pages", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/cms/pages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  submitForReview: (id) => request(`/admin/cms/pages/${id}/submit-review`, { method: "POST" }),
  approve: (id) => request(`/admin/cms/pages/${id}/approve`, { method: "POST" }),
  publish: (id) => request(`/admin/cms/pages/${id}/publish`, { method: "POST" }),
  schedule: (id, scheduledAt) => request(`/admin/cms/pages/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  archive: (id) => request(`/admin/cms/pages/${id}/archive`, { method: "POST" }),
  restore: (id) => request(`/admin/cms/pages/${id}/restore`, { method: "POST" }),
  sendBack: (id) => request(`/admin/cms/pages/${id}/send-back`, { method: "POST" }),
  duplicate: (id) => request(`/admin/cms/pages/${id}/duplicate`, { method: "POST" }),
  listRevisions: (id) => request(`/admin/cms/pages/${id}/revisions`),
  restoreRevision: (id, version) => request(`/admin/cms/pages/${id}/revisions/${version}/restore`, { method: "POST" }),
  runScheduler: () => request("/admin/cms/pages/run-scheduler", { method: "POST" }),
};

export const cmsBlogAPI = {
  getAll: (params = {}) => request(`/admin/cms/blog${toQueryString(params)}`),
  getById: (id) => request(`/admin/cms/blog/${id}`),
  create: (data) => request("/admin/cms/blog", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/cms/blog/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  submitForReview: (id) => request(`/admin/cms/blog/${id}/submit-review`, { method: "POST" }),
  approve: (id) => request(`/admin/cms/blog/${id}/approve`, { method: "POST" }),
  publish: (id) => request(`/admin/cms/blog/${id}/publish`, { method: "POST" }),
  schedule: (id, scheduledAt) => request(`/admin/cms/blog/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  archive: (id) => request(`/admin/cms/blog/${id}/archive`, { method: "POST" }),
  restore: (id) => request(`/admin/cms/blog/${id}/restore`, { method: "POST" }),
  sendBack: (id) => request(`/admin/cms/blog/${id}/send-back`, { method: "POST" }),
  duplicate: (id) => request(`/admin/cms/blog/${id}/duplicate`, { method: "POST" }),
  listRevisions: (id) => request(`/admin/cms/blog/${id}/revisions`),
  restoreRevision: (id, version) => request(`/admin/cms/blog/${id}/revisions/${version}/restore`, { method: "POST" }),
};

export const cmsMediaAPI = {
  getAll: (params = {}) => request(`/admin/cms/media${toQueryString(params)}`),
  // payload: { filename, type, url, mimeType, size, altText } — no real file
  // upload exists server-side yet (docs/cms.md), the caller supplies the URL.
  upload: (data) => request("/admin/cms/media", { method: "POST", body: JSON.stringify(data) }),
  delete: (id) => request(`/admin/cms/media/${id}`, { method: "DELETE" }),
  getOrphaned: (params = {}) => request(`/admin/cms/media/orphaned${toQueryString(params)}`),
};

export const cmsNavigationAPI = {
  listMenus: () => request("/admin/cms/navigation"),
  getMenu: (name) => request(`/admin/cms/navigation/${name}`),
  updateMenu: (name, items) => request(`/admin/cms/navigation/${name}`, { method: "PUT", body: JSON.stringify({ items }) }),
};

export const cmsFooterAPI = {
  get: () => request("/admin/cms/footer"),
  update: (data) => request("/admin/cms/footer", { method: "PUT", body: JSON.stringify(data) }),
};

export const cmsFaqAPI = {
  getAll: (params = {}) => request(`/admin/cms/faqs${toQueryString(params)}`),
  create: (data) => request("/admin/cms/faqs", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/cms/faqs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/admin/cms/faqs/${id}`, { method: "DELETE" }),
};

export const cmsBannerAPI = {
  getAll: (params = {}) => request(`/admin/cms/banners${toQueryString(params)}`),
  create: (data) => request("/admin/cms/banners", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/cms/banners/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/admin/cms/banners/${id}`, { method: "DELETE" }),
};

export const cmsRedirectAPI = {
  getAll: (params = {}) => request(`/admin/cms/redirects${toQueryString(params)}`),
  create: (data) => request("/admin/cms/redirects", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/cms/redirects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/admin/cms/redirects/${id}`, { method: "DELETE" }),
};

export const cmsSeoAPI = {
  get: () => request("/admin/cms/seo"),
  update: (data) => request("/admin/cms/seo", { method: "PUT", body: JSON.stringify(data) }),
};

export const searchAPI = {
  // params: { q, categoryId, minPrice, maxPrice, rating, availability, sort, page, limit }
  // Response: { query, products, total, page, pageSize, totalPages, facets,
  // sort, appliedFilters, didYouMean?, popularProducts?, suggestedSearches? }
  // — or { redirect } if a merchandising redirect rule fired for this query.
  search: (params = {}, { signal } = {}) => request(`/search${toQueryString(params)}`, { signal }),
  // Minimum 2 characters. { products, categories, searches }
  autocomplete: (q, { signal } = {}) => request(`/search/autocomplete${toQueryString({ q })}`, { signal }),
  // { suggestions }
  suggestions: (q, { signal } = {}) => request(`/search/suggestions${toQueryString({ q })}`, { signal }),
  // Fire-and-forget from call sites — never awaited before navigation.
  // position is 1-indexed (matches the 1-based rank shown to the customer).
  trackClick: (payload) =>
    request("/search/events/click", { method: "POST", body: JSON.stringify(payload) }),
};

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS (Phase 16) — customer Notification Center + preferences + devices
// ═══════════════════════════════════════════════════════════════════
export const notificationsAPI = {
  list: (params = {}) => request(`/notifications${toQueryString(params)}`),
  unreadCount: () => request("/notifications/unread-count"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all", { method: "POST" }),
  archive: (id) => request(`/notifications/${id}/archive`, { method: "PATCH" }),
  getPreferences: () => request("/notifications/preferences"),
  updatePreferences: (data) => request("/notifications/preferences", { method: "PATCH", body: JSON.stringify(data) }),
  unsubscribe: () => request("/notifications/unsubscribe", { method: "POST" }),
  registerDevice: (data) => request("/notifications/devices", { method: "POST", body: JSON.stringify(data) }),
  listDevices: () => request("/notifications/devices"),
  revokeDevice: (deviceId) => request(`/notifications/devices/${deviceId}`, { method: "DELETE" }),
};

export const adminNotificationsAPI = {
  list: (params = {}) => request(`/admin/notifications${toQueryString(params)}`),
  listDeliveries: (params = {}) => request(`/admin/notifications/deliveries${toQueryString(params)}`),
  getDelivery: (id) => request(`/admin/notifications/deliveries/${id}`),
  listDeadLetter: (params = {}) => request(`/admin/notifications/dead-letter${toQueryString(params)}`),
  retryDeadLetter: (id) => request(`/admin/notifications/dead-letter/${id}/retry`, { method: "POST" }),
  cancelDeadLetter: (id) => request(`/admin/notifications/dead-letter/${id}/cancel`, { method: "POST" }),
  processRetries: () => request("/admin/notifications/process-retries", { method: "POST" }),
  reprocessEvents: () => request("/admin/notifications/reprocess-events", { method: "POST" }),
  listTemplates: (params = {}) => request(`/admin/notifications/templates${toQueryString(params)}`),
  createTemplate: (data) => request("/admin/notifications/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/admin/notifications/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  publishTemplate: (id) => request(`/admin/notifications/templates/${id}/publish`, { method: "POST" }),
  listTemplateRevisions: (id) => request(`/admin/notifications/templates/${id}/revisions`),
  restoreTemplateRevision: (id, revisionId) => request(`/admin/notifications/templates/${id}/revisions/${revisionId}/restore`, { method: "POST" }),
  previewTemplate: (id, sampleData) => request(`/admin/notifications/templates/${id}/preview`, { method: "POST", body: JSON.stringify({ sampleData }) }),
  sendTest: (data) => request("/admin/notifications/test", { method: "POST", body: JSON.stringify(data) }),
  listSuppressions: (params = {}) => request(`/admin/notifications/suppressions${toQueryString(params)}`),
  removeSuppression: (channel, value) => request(`/admin/notifications/suppressions/${channel}/${encodeURIComponent(value)}`, { method: "DELETE" }),
  getProviders: () => request("/admin/notifications/providers"),
  getDeliveryStats: (params = {}) => request(`/admin/notifications/analytics/deliveries${toQueryString(params)}`),
  getQueueHealth: () => request("/admin/notifications/analytics/queue-health"),
};

export const adminCampaignsAPI = {
  list: (params = {}) => request(`/admin/campaigns${toQueryString(params)}`),
  create: (data) => request("/admin/campaigns", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/admin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  schedule: (id, data) => request(`/admin/campaigns/${id}/schedule`, { method: "POST", body: JSON.stringify(data) }),
  pause: (id) => request(`/admin/campaigns/${id}/pause`, { method: "POST" }),
  send: (id) => request(`/admin/campaigns/${id}/send`, { method: "POST" }),
  getAnalytics: (id) => request(`/admin/campaigns/${id}/analytics`),
};

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS (Phase 17) — public event ingestion + admin dashboards
// ═══════════════════════════════════════════════════════════════════
export const analyticsAPI = {
  // Fire-and-forget from call sites — never awaited before navigation,
  // and never allowed to throw into a caller's UI flow.
  track: (event) => request("/analytics/events", { method: "POST", body: JSON.stringify(event) }).catch(() => {}),
};

export const adminAnalyticsAPI = {
  overview: (params = {}) => request(`/admin/analytics/overview${toQueryString(params)}`),
  sales: (params = {}) => request(`/admin/analytics/sales${toQueryString(params)}`),
  orders: (params = {}) => request(`/admin/analytics/orders${toQueryString(params)}`),
  customers: (params = {}) => request(`/admin/analytics/customers${toQueryString(params)}`),
  customerLTV: () => request("/admin/analytics/customers/clv"),
  retention: (params = {}) => request(`/admin/analytics/customers/retention${toQueryString(params)}`),
  products: (params = {}) => request(`/admin/analytics/products${toQueryString(params)}`),
  categories: (params = {}) => request(`/admin/analytics/categories${toQueryString(params)}`),
  inventory: () => request("/admin/analytics/inventory"),
  lowStock: (params = {}) => request(`/admin/analytics/inventory/low-stock${toQueryString(params)}`),
  payments: (params = {}) => request(`/admin/analytics/payments${toQueryString(params)}`),
  shipping: (params = {}) => request(`/admin/analytics/shipping${toQueryString(params)}`),
  discounts: (params = {}) => request(`/admin/analytics/discounts${toQueryString(params)}`),
  reviews: (params = {}) => request(`/admin/analytics/reviews${toQueryString(params)}`),
  search: (params = {}) => request(`/admin/analytics/search${toQueryString(params)}`),
  notifications: (params = {}) => request(`/admin/analytics/notifications${toQueryString(params)}`),
  funnel: (params = {}) => request(`/admin/analytics/funnel${toQueryString(params)}`),
  cohorts: (params = {}) => request(`/admin/analytics/cohorts${toQueryString(params)}`),
  requestExport: (data) => request("/admin/analytics/exports", { method: "POST", body: JSON.stringify(data) }),
  getExportStatus: (id) => request(`/admin/analytics/exports/${id}`),
  downloadExportUrl: (id, token) => `${BASE}/admin/analytics/exports/${id}/download?token=${encodeURIComponent(token)}`,
  listReports: () => request("/admin/analytics/reports"),
  createReport: (data) => request("/admin/analytics/reports", { method: "POST", body: JSON.stringify(data) }),
  runReport: (id) => request(`/admin/analytics/reports/${id}/run`, { method: "POST" }),
  reconcile: (params = {}) => request(`/admin/analytics/reconcile${toQueryString(params)}`),
  rebuild: (params = {}) => request(`/admin/analytics/rebuild${toQueryString(params)}`, { method: "POST" }),
};

// ═══════════════════════════════════════════════════════════════════
// GROWTH (Phase 24) — recently viewed, recommendations, reorder, stock
// alerts, loyalty, referrals, feature flags
// ═══════════════════════════════════════════════════════════════════
export const growthAPI = {
  // Fire-and-forget, same convention as analyticsAPI.track — never
  // allowed to throw into a caller's UI flow.
  recordView: (productId) => request("/growth/views", { method: "POST", body: JSON.stringify({ productId }) }).catch(() => {}),
  getRecentlyViewed: (params = {}) => request(`/growth/recently-viewed${toQueryString(params)}`),
  getRelated: (productId, params = {}) => request(`/growth/products/${productId}/related${toQueryString(params)}`),
  getFrequentlyBoughtTogether: (productId, params = {}) => request(`/growth/products/${productId}/frequently-bought-together${toQueryString(params)}`),
  checkFlag: (key) => request(`/growth/flags/${key}`).catch(() => ({ key, enabled: false })),

  getReorderPreview: (orderId) => request(`/growth/orders/${orderId}/reorder-preview`),
  reorder: (orderId) => request(`/growth/orders/${orderId}/reorder`, { method: "POST" }),

  subscribeStockAlert: (data) => request("/growth/stock-alerts", { method: "POST", body: JSON.stringify(data) }),
  unsubscribeStockAlert: (id) => request(`/growth/stock-alerts/${id}`, { method: "DELETE" }),
  listStockAlerts: () => request("/growth/stock-alerts"),

  getLoyaltyBalance: () => request("/growth/loyalty/balance"),
  getLoyaltyLedger: (params = {}) => request(`/growth/loyalty/ledger${toQueryString(params)}`),

  getReferralCode: () => request("/growth/referrals/code"),
  getReferrals: () => request("/growth/referrals"),
};
