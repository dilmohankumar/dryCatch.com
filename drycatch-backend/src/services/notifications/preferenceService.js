import NotificationPreference from "../../models/NotificationPreference.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

// Safe defaults live HERE, centrally (rule #32) — never as scattered
// `if (user.emailNotification)` checks throughout the codebase. Security
// notifications default to fully on and are also marked
// criticalBypassesPreferences in rules.js as defense in depth.
const DEFAULTS = {
  transactional: { email: true, sms: false, push: true, in_app: true },
  marketing: { email: true, sms: false, push: false, in_app: false },
  security: { email: true, sms: false, push: true, in_app: true },
  orderUpdates: { email: true, sms: true, push: true, in_app: true },
  shippingUpdates: { email: true, sms: true, push: true, in_app: true },
  reviews: { email: false, sms: false, push: false, in_app: true },
};

// Per-event-type overrides (more granular than category alone) — checked
// first; anything not listed here falls back to CATEGORY_TO_GROUP. This is
// what lets "shipping updates" and "order updates" be independently
// togglable even though both events currently share category "transactional".
const EVENT_TO_GROUP = {
  [EVENT_TYPES.ORDER_CREATED]: "orderUpdates",
  [EVENT_TYPES.ORDER_CONFIRMED]: "orderUpdates",
  [EVENT_TYPES.ORDER_CANCELLED]: "orderUpdates",
  [EVENT_TYPES.SHIPMENT_CREATED]: "shippingUpdates",
  [EVENT_TYPES.ORDER_SHIPPED]: "shippingUpdates",
  [EVENT_TYPES.ORDER_OUT_FOR_DELIVERY]: "shippingUpdates",
  [EVENT_TYPES.ORDER_DELIVERED]: "shippingUpdates",
  [EVENT_TYPES.REVIEW_APPROVED]: "reviews",
  [EVENT_TYPES.REVIEW_REJECTED]: "reviews",
};

const CATEGORY_TO_GROUP = {
  transactional: "transactional",
  security: "security",
  marketing: "marketing",
  system: "orderUpdates",
  admin: null, // admin notifications aren't subject to a customer's own preferences
};

export async function getPreferences(userId) {
  const pref = await NotificationPreference.findOne({ user: userId });
  return pref ? mergeDefaults(pref) : { user: userId, ...DEFAULTS };
}

function mergeDefaults(pref) {
  const obj = pref.toObject();
  const merged = { user: obj.user, unsubscribedAt: obj.unsubscribedAt };
  for (const group of Object.keys(DEFAULTS)) merged[group] = { ...DEFAULTS[group], ...(obj[group] || {}) };
  return merged;
}

export async function updatePreferences(userId, updates) {
  const pref = await NotificationPreference.findOneAndUpdate(
    { user: userId },
    { $set: updates },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return mergeDefaults(pref);
}

export async function unsubscribeFromMarketing(userId) {
  return NotificationPreference.findOneAndUpdate(
    { user: userId },
    { $set: { unsubscribedAt: new Date() } },
    { upsert: true, new: true }
  );
}

// The single decision point the notification engine calls (rule #28) —
// "should THIS user get THIS notification on THIS channel."
export async function isChannelAllowed(userId, { category, channel, eventType, criticalBypassesPreferences }) {
  if (criticalBypassesPreferences) return true; // rule #29 — security/legal/confirmation notifications aren't opt-out-able
  const prefs = await getPreferences(userId);
  if (category === "marketing" && prefs.unsubscribedAt) return false; // rule #33 — global unsubscribe wins
  const group = EVENT_TO_GROUP[eventType] || CATEGORY_TO_GROUP[category];
  if (!group) return true;
  return prefs[group]?.[channel] !== false;
}
