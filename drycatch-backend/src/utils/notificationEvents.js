// The full domain event catalog (rule #22). Every business module publishes
// one of these via eventBus.publish() — never calls a channel/provider
// directly (rule #2/#158's "do not do this: OrderService -> sendEmail()").
export const EVENT_TYPES = {
  // Auth (Phase 1)
  USER_REGISTERED: "USER_REGISTERED",
  EMAIL_VERIFICATION_REQUIRED: "EMAIL_VERIFICATION_REQUIRED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  LOGIN_SECURITY_ALERT: "LOGIN_SECURITY_ALERT",
  // Orders (Phase 9)
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  // Payments (Phase 8)
  PAYMENT_SUCCESSFUL: "PAYMENT_SUCCESSFUL",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_CREATED: "REFUND_CREATED",
  REFUND_COMPLETED: "REFUND_COMPLETED",
  // Shipping (Phase 10)
  SHIPMENT_CREATED: "SHIPMENT_CREATED",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  // Inventory (Phase 5)
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  BACK_IN_STOCK: "BACK_IN_STOCK",
  // Reviews (Phase 12)
  REVIEW_CREATED: "REVIEW_CREATED",
  REVIEW_APPROVED: "REVIEW_APPROVED",
  REVIEW_REJECTED: "REVIEW_REJECTED",
  // CMS (Phase 15)
  CONTENT_PUBLISHED: "CONTENT_PUBLISHED",
  CONTENT_PUBLISH_FAILED: "CONTENT_PUBLISH_FAILED",
  // Cart (Phase 6) — dispatched by a lazy check, not immediately (rule #127)
  ABANDONED_CART: "ABANDONED_CART",
  // Admin/system-originated (no single business module owns these)
  ADMIN_ALERT: "ADMIN_ALERT",
  // Phase 17 — Analytics
  REPORT_READY: "REPORT_READY",
  // Phase 24 — Growth. BACK_IN_STOCK already existed (Phase 5/16) but had
  // no subscriber data to target individual customers with — Phase 24's
  // StockAlertSubscription model + growth/stockAlertService.js closes
  // that gap for both this and PRICE_DROPPED.
  PRICE_DROPPED: "PRICE_DROPPED",
};

export const ALL_EVENT_TYPES = Object.values(EVENT_TYPES);
