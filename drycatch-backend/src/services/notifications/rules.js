import { EVENT_TYPES } from "../../utils/notificationEvents.js";

// The rule table (rule #27) — configurable in the sense that it's one
// object, not scattered if/else across every business service. Each rule
// says: who is this for, how urgent, which channels by default, and
// whether it's allowed to bypass a user's marketing/preference opt-outs.
// `criticalBypassesPreferences: true` is reserved for security/legal/
// transactional-confirmation cases (rule #29) — never for marketing.
export const NOTIFICATION_RULES = {
  [EVENT_TYPES.USER_REGISTERED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"] },
  // channels intentionally exclude "email" here — the actual OTP/reset
  // code is still sent through the existing direct utils/otp.js call
  // (a security-critical single code path predating this phase, left
  // untouched rather than risking a second, differently-worded email with
  // a different OTP going out). These events exist purely so the action
  // is visible in the Notification Center / audit trail.
  [EVENT_TYPES.EMAIL_VERIFICATION_REQUIRED]: { recipientType: "customer", category: "security", priority: "high", channels: ["in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.PASSWORD_RESET_REQUESTED]: { recipientType: "customer", category: "security", priority: "high", channels: ["in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.PASSWORD_CHANGED]: { recipientType: "customer", category: "security", priority: "high", channels: ["email", "in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.LOGIN_SECURITY_ALERT]: { recipientType: "customer", category: "security", priority: "critical", channels: ["email", "in_app"], criticalBypassesPreferences: true },

  [EVENT_TYPES.ORDER_CREATED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.ORDER_CONFIRMED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.ORDER_CANCELLED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"] },

  [EVENT_TYPES.PAYMENT_SUCCESSFUL]: { recipientType: "customer", category: "transactional", priority: "high", channels: ["email", "in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.PAYMENT_FAILED]: { recipientType: "customer", category: "transactional", priority: "high", channels: ["email", "in_app"], criticalBypassesPreferences: true },
  [EVENT_TYPES.REFUND_CREATED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"] },
  [EVENT_TYPES.REFUND_COMPLETED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"] },

  [EVENT_TYPES.SHIPMENT_CREATED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["in_app"] },
  [EVENT_TYPES.ORDER_SHIPPED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "sms", "in_app"] },
  [EVENT_TYPES.ORDER_OUT_FOR_DELIVERY]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["sms", "in_app"] },
  [EVENT_TYPES.ORDER_DELIVERED]: { recipientType: "customer", category: "transactional", priority: "normal", channels: ["email", "in_app"] },

  [EVENT_TYPES.LOW_STOCK]: { recipientType: "admin", category: "admin", priority: "normal", channels: ["in_app"] },
  [EVENT_TYPES.OUT_OF_STOCK]: { recipientType: "admin", category: "admin", priority: "high", channels: ["in_app"] },
  [EVENT_TYPES.BACK_IN_STOCK]: { recipientType: "customer", category: "system", priority: "low", channels: ["email", "in_app"] },

  [EVENT_TYPES.REVIEW_CREATED]: { recipientType: "admin", category: "admin", priority: "low", channels: ["in_app"] },
  [EVENT_TYPES.REVIEW_APPROVED]: { recipientType: "customer", category: "system", priority: "low", channels: ["in_app"] },
  [EVENT_TYPES.REVIEW_REJECTED]: { recipientType: "customer", category: "system", priority: "low", channels: ["in_app"] },

  [EVENT_TYPES.CONTENT_PUBLISHED]: { recipientType: "admin", category: "admin", priority: "low", channels: ["in_app"] },
  [EVENT_TYPES.CONTENT_PUBLISH_FAILED]: { recipientType: "admin", category: "admin", priority: "high", channels: ["in_app"] },

  [EVENT_TYPES.ABANDONED_CART]: { recipientType: "customer", category: "marketing", priority: "low", channels: ["email"] },

  [EVENT_TYPES.ADMIN_ALERT]: { recipientType: "admin", category: "admin", priority: "high", channels: ["in_app"] },
  // Phase 17 — a generated report is ready. Reuses the existing
  // notification pipeline (rule #84: "reports can be delivered through
  // email/download/notification") rather than building a second delivery
  // mechanism.
  [EVENT_TYPES.REPORT_READY]: { recipientType: "admin", category: "admin", priority: "normal", channels: ["in_app", "email"] },
};

export function getRule(eventType) {
  return NOTIFICATION_RULES[eventType] || null;
}
