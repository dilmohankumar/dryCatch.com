import { analyticsAPI } from "./api.js";

// Client-side behavioral event instrumentation (rule #57). Fire-and-forget
// by design (analyticsAPI.track already swallows its own errors) — a
// failed analytics call must never interrupt the shopping experience.
const ANON_KEY = "dc_anonymous_id";

function getAnonymousId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

function getDeviceType() {
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function track(eventType, properties = {}) {
  analyticsAPI.track({
    eventType,
    anonymousId: getAnonymousId(),
    timestamp: new Date().toISOString(),
    source: "web",
    device: getDeviceType(),
    page: window.location.pathname,
    properties,
  });
}

export const trackProductView = (productId) => track("PRODUCT_VIEW", { productId });
export const trackCategoryView = (categoryId) => track("CATEGORY_VIEW", { categoryId });
export const trackAddToCart = (productId, quantity) => track("ADD_TO_CART", { productId, quantity });
export const trackRemoveFromCart = (productId) => track("REMOVE_FROM_CART", { productId });
export const trackCheckoutStarted = (cartValue) => track("CHECKOUT_STARTED", { cartValue });
export const trackPaymentStarted = (orderId) => track("PAYMENT_STARTED", { orderId });
export const trackWishlistAdd = (productId) => track("WISHLIST_ADD", { productId });
export const trackWishlistRemove = (productId) => track("WISHLIST_REMOVE", { productId });
