import Notification from "../../models/Notification.js";
import NotificationDelivery from "../../models/NotificationDelivery.js";
import * as emailChannel from "./channels/emailChannel.js";
import * as smsChannel from "./channels/smsChannel.js";
import * as pushChannel from "./channels/pushChannel.js";
import * as whatsappChannel from "./channels/whatsappChannel.js";
import * as inAppChannel from "./channels/inAppChannel.js";

const BACKOFF_MINUTES = [1, 5, 30]; // attempt 1 -> retry in 1min, attempt 2 -> 5min, attempt 3 -> 30min, then DLQ (rule #51)

function classifyAndNextAttempt(delivery, result) {
  if (result.errorClass === "permanent" || result.errorClass === "invalid_recipient") {
    return { status: "failed", terminal: true }; // rule #52 — never blindly retry a permanent failure
  }
  const nextAttempt = delivery.attempt + 1;
  if (nextAttempt >= delivery.maxAttempts) return { status: "failed", terminal: true }; // exhausted retries -> DLQ (rule #53)
  const delayMs = (BACKOFF_MINUTES[delivery.attempt] || 30) * 60 * 1000;
  return { status: "retrying", terminal: false, nextAttemptAt: new Date(Date.now() + delayMs) };
}

// Processes ONE delivery attempt for ONE channel. Idempotent by design
// (rule #129): if a delivery is already "sent"/"delivered", calling this
// again is a no-op rather than re-sending.
export async function processDelivery(delivery, notification) {
  if (["sent", "delivered", "cancelled"].includes(delivery.status)) return delivery;

  delivery.status = "processing";
  delivery.attempt += 1;
  await delivery.save();

  let result;
  try {
    if (delivery.channel === "email") {
      const recipient = delivery.recipient || (await emailChannel.resolveRecipient(notification.user));
      if (!recipient) result = { success: false, status: "failed", error: "no email on file", errorClass: "invalid_recipient" };
      else result = await emailChannel.send({ recipient, subject: notification.title, body: notification.body });
    } else if (delivery.channel === "sms") {
      const recipient = delivery.recipient || (await smsChannel.resolveRecipient(notification.user));
      if (!recipient) result = { success: false, status: "failed", error: "no phone on file", errorClass: "invalid_recipient" };
      else result = await smsChannel.send({ recipient, body: notification.body });
    } else if (delivery.channel === "whatsapp") {
      const recipient = delivery.recipient || (await whatsappChannel.resolveRecipient(notification.user));
      if (!recipient) result = { success: false, status: "failed", error: "no phone on file", errorClass: "invalid_recipient" };
      else result = await whatsappChannel.send({ recipient, body: notification.body });
    } else if (delivery.channel === "push" || delivery.channel === "web_push") {
      if (!delivery.recipient) result = { success: false, status: "failed", error: "no device token", errorClass: "invalid_recipient" };
      else result = await pushChannel.send({ device: { pushToken: delivery.recipient, _id: delivery._id }, title: notification.title, body: notification.body, data: notification.data });
    } else {
      result = await inAppChannel.send();
    }
  } catch (err) {
    result = { success: false, status: "failed", error: err.message, errorClass: "temporary" };
  }

  if (result.success) {
    delivery.status = result.status; // "sent" or "delivered"
    delivery.provider = result.provider;
    delivery.providerMessageId = result.providerMessageId;
    delivery.sentAt = new Date();
    if (result.status === "delivered") delivery.deliveredAt = new Date();
  } else if (result.status === "cancelled") {
    // Suppressed recipient — a terminal, non-retryable state distinct from
    // "failed" (rule #20/#98): this was never attempted with a provider at
    // all, so it shouldn't count toward provider failure-rate metrics.
    delivery.status = "cancelled";
    delivery.errorMessage = result.error;
  } else {
    const classification = classifyAndNextAttempt(delivery, result);
    delivery.status = classification.status;
    delivery.errorClass = result.errorClass;
    delivery.errorMessage = result.error;
    delivery.provider = result.provider;
    if (classification.terminal) delivery.failedAt = new Date();
    else delivery.nextAttemptAt = classification.nextAttemptAt;
  }
  await delivery.save();
  return delivery;
}

export async function createAndProcessDeliveries(notification, recipients) {
  const deliveries = [];
  for (const channel of notification.channels) {
    const recipient = recipients?.[channel];
    const delivery = await NotificationDelivery.create({ notification: notification._id, channel, recipient });
    await processDelivery(delivery, notification);
    deliveries.push(delivery);
  }
  const anyFailed = deliveries.some((d) => d.status === "failed");
  const anySent = deliveries.some((d) => ["sent", "delivered"].includes(d.status));
  notification.status = anySent && anyFailed ? "partial" : anyFailed ? "failed" : "sent";
  await notification.save();
  return deliveries;
}

// Lazy retry poller (rule #51/#134) — same "no real scheduler exists"
// pattern as eventBus.reprocessPendingEvents and CMS's scheduled publish:
// admin-triggered or called on an interval by the process itself, not by
// a real job queue.
export async function processRetries(limit = 100) {
  const due = await NotificationDelivery.find({ status: "retrying", nextAttemptAt: { $lte: new Date() } })
    .limit(limit)
    .populate("notification");
  const results = [];
  for (const delivery of due) {
    if (!delivery.notification) continue;
    await processDelivery(delivery, delivery.notification);
    results.push({ id: delivery._id, status: delivery.status });
  }
  return results;
}

// Dead Letter Queue view (rule #53) — deliveries that exhausted retries.
export async function listDeadLetter({ page = 1, limit = 50 } = {}) {
  const filter = { status: "failed" };
  const [items, total] = await Promise.all([
    NotificationDelivery.find(filter).sort({ failedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("notification"),
    NotificationDelivery.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export async function retryDeadLetter(deliveryId) {
  const delivery = await NotificationDelivery.findById(deliveryId).populate("notification");
  if (!delivery) throw Object.assign(new Error("Delivery not found"), { statusCode: 404, code: "DELIVERY_NOT_FOUND" });
  delivery.attempt = 0;
  delivery.status = "pending";
  await delivery.save();
  return processDelivery(delivery, delivery.notification);
}

export async function cancelDeadLetter(deliveryId) {
  return NotificationDelivery.findByIdAndUpdate(deliveryId, { $set: { status: "cancelled" } }, { new: true });
}
