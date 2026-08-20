import { EVENT_TYPES } from "../../utils/notificationEvents.js";

// Built-in default copy per event (rule #158's "notification engine works"
// out of the box, with zero admin setup) — an admin can override any of
// these by publishing a NotificationTemplate for the same (type, channel),
// which templateService.renderForEvent takes priority over this.
export const DEFAULT_CONTENT = {
  [EVENT_TYPES.USER_REGISTERED]: () => ({ title: "Welcome to DryCatch!", body: "Your account has been created successfully." }),
  [EVENT_TYPES.EMAIL_VERIFICATION_REQUIRED]: (p) => ({ title: "Verify your email", body: `Your verification code is ${p.otp || ""}.` }),
  [EVENT_TYPES.PASSWORD_RESET_REQUESTED]: () => ({ title: "Password reset requested", body: "Use the link we sent to reset your password. If this wasn't you, ignore this message." }),
  [EVENT_TYPES.PASSWORD_CHANGED]: () => ({ title: "Your password was changed", body: "Your account password was just changed. Contact support if this wasn't you." }),
  [EVENT_TYPES.LOGIN_SECURITY_ALERT]: (p) => ({ title: "New login detected", body: `A new login was detected${p.location ? ` from ${p.location}` : ""}. Contact support if this wasn't you.` }),

  [EVENT_TYPES.ORDER_CREATED]: (p) => ({ title: "Order placed", body: `Your order #${p.orderNumber || p.orderId} has been placed.` }),
  [EVENT_TYPES.ORDER_CONFIRMED]: (p) => ({ title: "Order confirmed", body: `Your order #${p.orderNumber || p.orderId} has been confirmed.` }),
  [EVENT_TYPES.ORDER_CANCELLED]: (p) => ({ title: "Order cancelled", body: `Your order #${p.orderNumber || p.orderId} has been cancelled.` }),

  [EVENT_TYPES.PAYMENT_SUCCESSFUL]: (p) => ({ title: "Payment received", body: `We received your payment for order #${p.orderNumber || p.orderId}.` }),
  [EVENT_TYPES.PAYMENT_FAILED]: (p) => ({ title: "Payment failed", body: `Your payment for order #${p.orderNumber || p.orderId} failed. Please try again.` }),
  [EVENT_TYPES.REFUND_CREATED]: (p) => ({ title: "Refund initiated", body: `A refund has been initiated for order #${p.orderNumber || p.orderId}.` }),
  [EVENT_TYPES.REFUND_COMPLETED]: (p) => ({ title: "Refund completed", body: `Your refund for order #${p.orderNumber || p.orderId} has been completed.` }),

  [EVENT_TYPES.SHIPMENT_CREATED]: (p) => ({ title: "Shipment created", body: `A shipment has been created for order #${p.orderNumber || p.orderId}.` }),
  [EVENT_TYPES.ORDER_SHIPPED]: (p) => ({ title: "Order shipped", body: `Your order #${p.orderNumber || p.orderId} has shipped${p.trackingNumber ? ` (tracking: ${p.trackingNumber})` : ""}.` }),
  [EVENT_TYPES.ORDER_OUT_FOR_DELIVERY]: (p) => ({ title: "Out for delivery", body: `Your order #${p.orderNumber || p.orderId} is out for delivery.` }),
  [EVENT_TYPES.ORDER_DELIVERED]: (p) => ({ title: "Order delivered", body: `Your order #${p.orderNumber || p.orderId} has been delivered.` }),

  [EVENT_TYPES.LOW_STOCK]: (p) => ({ title: "Low stock alert", body: `${p.productName || "A product"} is running low on stock.` }),
  [EVENT_TYPES.OUT_OF_STOCK]: (p) => ({ title: "Out of stock", body: `${p.productName || "A product"} is now out of stock.` }),
  [EVENT_TYPES.BACK_IN_STOCK]: (p) => ({ title: "Back in stock", body: `${p.productName || "An item on your wishlist"} is back in stock.` }),

  [EVENT_TYPES.REVIEW_CREATED]: (p) => ({ title: "New review submitted", body: `A new review was submitted for ${p.productName || "a product"} and needs moderation.` }),
  [EVENT_TYPES.REVIEW_APPROVED]: () => ({ title: "Your review was approved", body: "Thanks — your review is now live." }),
  [EVENT_TYPES.REVIEW_REJECTED]: () => ({ title: "Your review was not approved", body: "Your submitted review did not meet our guidelines." }),

  [EVENT_TYPES.CONTENT_PUBLISHED]: (p) => ({ title: "Content published", body: `"${p.title || p.slug}" was published.` }),
  [EVENT_TYPES.CONTENT_PUBLISH_FAILED]: (p) => ({ title: "Content publish failed", body: `Publishing "${p.title || p.slug}" failed: ${p.error || "unknown error"}.` }),

  [EVENT_TYPES.ABANDONED_CART]: () => ({ title: "You left something in your cart", body: "Come back and complete your order before it's gone." }),

  [EVENT_TYPES.ADMIN_ALERT]: (p) => ({ title: p.title || "Admin alert", body: p.message || "" }),
  [EVENT_TYPES.REPORT_READY]: (p) => ({ title: "Report ready", body: `"${p.reportName || p.reportType}" has finished generating.` }),
};

export function buildDefaultContent(eventType, payload = {}) {
  const builder = DEFAULT_CONTENT[eventType];
  return builder ? builder(payload) : { title: eventType, body: JSON.stringify(payload) };
}
