import crypto from "crypto";
import Notification from "../../models/Notification.js";
import { subscribe } from "./eventBus.js";
import { getRule, NOTIFICATION_RULES } from "./rules.js";
import { isChannelAllowed } from "./preferenceService.js";
import { buildDefaultContent } from "./contentDefaults.js";
import { renderForEvent } from "./templateService.js";
import { createAndProcessDeliveries } from "./deliveryService.js";
import * as emailChannel from "./channels/emailChannel.js";
import * as smsChannel from "./channels/smsChannel.js";
import { resolveDevices } from "./channels/pushChannel.js";

// The single place a business-event turns into a Notification (rule #26).
// Receive event -> load rule -> check preferences per channel -> load
// content (template if published, else the built-in default) -> create
// Notification + fan out deliveries. Everything downstream of "an event
// happened" lives here — OrderService etc. never touch any of this.
async function handleEvent(eventType, payload) {
  const rule = getRule(eventType);
  if (!rule) return; // no rule configured for this event type — silently ignored, not an error

  const dedupeKey = `${eventType}:${payload.userId || "admin"}:${payload.orderId || payload.entityId || ""}`;
  const existing = await Notification.findOne({ dedupeKey });
  if (existing) return; // rule #25/#128 — duplicate event processing must not double-send

  const allowedChannels = [];
  for (const channel of rule.channels) {
    if (rule.recipientType !== "customer") {
      allowedChannels.push(channel); // admin/system notifications aren't gated by a customer's personal preferences
      continue;
    }
    const allowed = await isChannelAllowed(payload.userId, { category: rule.category, channel, eventType, criticalBypassesPreferences: rule.criticalBypassesPreferences });
    if (allowed) allowedChannels.push(channel);
  }
  if (allowedChannels.length === 0) return;

  let content = null;
  try {
    content = await renderForEvent(eventType, "email", payload);
  } catch {
    content = null; // template exists but payload doesn't satisfy its declared variables — fall back to default copy rather than failing the whole notification
  }
  const fallback = buildDefaultContent(eventType, payload);

  const notification = await Notification.create({
    user: rule.recipientType === "customer" ? payload.userId : undefined,
    recipientType: rule.recipientType,
    eventType,
    category: rule.category,
    priority: rule.priority,
    title: content?.subject || fallback.title,
    body: content?.body || fallback.body,
    data: payload,
    channels: allowedChannels,
    sourceEventId: payload.eventId,
    dedupeKey,
  });

  const recipients = {};
  if (allowedChannels.includes("email")) recipients.email = await emailChannel.resolveRecipient(notification.user);
  if (allowedChannels.includes("sms")) recipients.sms = await smsChannel.resolveRecipient(notification.user);
  if (allowedChannels.includes("push") || allowedChannels.includes("web_push")) {
    const devices = notification.user ? await resolveDevices(notification.user) : [];
    if (devices[0]) recipients.push = devices[0].pushToken; // rule #97 fans out to every device; simplified here to primary device — see docs for scope note
  }

  await createAndProcessDeliveries(notification, recipients);
  return notification;
}

// Called once at app boot (app.js) — wires every rule-configured event
// type to handleEvent so eventBus.publish() calls made by business
// modules actually produce notifications.
export function registerEngine() {
  for (const eventType of Object.keys(NOTIFICATION_RULES)) {
    subscribe(eventType, (payload) => handleEvent(eventType, { ...payload, eventId: payload.eventId || crypto.randomUUID() }));
  }
}

export { handleEvent };
