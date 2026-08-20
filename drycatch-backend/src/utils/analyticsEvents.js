// Client-instrumented behavioral events (rule #57), ingested via
// POST /api/v1/analytics/events. Distinct from Phase 16's domain events
// (ORDER_CREATED etc.) which are server-authoritative and already fire
// reliably from business services — these are the funnel/browsing events
// nothing else in the codebase currently emits.
export const BEHAVIORAL_EVENT_TYPES = new Set([
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "CATEGORY_VIEW",
  "SEARCH",
  "ADD_TO_CART",
  "REMOVE_FROM_CART",
  "CHECKOUT_STARTED",
  "PAYMENT_STARTED",
  "PURCHASE",
  "REFUND",
  "REVIEW_CREATED",
  "WISHLIST_ADD",
  "WISHLIST_REMOVE",
]);

export const CURRENT_SCHEMA_VERSION = 1;
