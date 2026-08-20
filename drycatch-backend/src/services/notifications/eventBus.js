import crypto from "crypto";
import { EventEmitter } from "events";
import NotificationEvent from "../../models/NotificationEvent.js";

// This project has no message broker anywhere (no Redis/BullMQ/Kafka in
// package.json, confirmed by audit) — every "scheduled"/"queued" thing in
// prior phases (Cart/Checkout expiry, CMS publish scheduling) is a lazy
// check, not a real worker. This event bus follows the same honest
// pattern: an in-process EventEmitter for immediate fan-out, backed by the
// NotificationEvent outbox for durability (rule #130) — if the process
// crashes between persisting the event and a listener finishing, the row
// is still there with status "pending" for processRecovery() to replay.
// Swapping in a real broker later means replacing publish()'s internals,
// not touching a single caller.
const bus = new EventEmitter();
bus.setMaxListeners(50);

export function subscribe(eventType, handler) {
  bus.on(eventType, handler);
}

// Business modules call this — never a channel/provider directly (rule #2).
// `payload` must stay minimal (ids only, rule #23); the notification engine
// re-fetches whatever it needs at render time so it always sees current data.
export async function publish(eventType, payload, { source } = {}) {
  const eventId = crypto.randomUUID();
  const event = await NotificationEvent.create({ eventId, eventType, source: source || "unknown", payload });

  try {
    // Listeners run in-process, synchronously awaited here, so a failure
    // is visible immediately rather than silently swallowed by the
    // EventEmitter's fire-and-forget default behavior.
    const listeners = bus.listeners(eventType);
    for (const listener of listeners) {
      await listener(payload, event);
    }
    event.status = "processed";
    event.processedAt = new Date();
    await event.save();
  } catch (err) {
    event.status = "failed";
    event.error = err.message;
    await event.save();
    // Do not rethrow — a notification failure must never break the business
    // transaction that triggered it (rule #156: order creation stays fast
    // and successful even if the notification pipeline has a bug).
    // eslint-disable-next-line no-console
    console.error(`[notifications] event ${eventType} (${eventId}) failed:`, err.message);
  }
  return event;
}

// Recovery pass for events left "pending" by a crash mid-processing
// (rule #133). Admin-triggered or called on boot — no real scheduler
// exists in this project, so this mirrors CMS's processScheduledPages
// lazy-invocation pattern rather than claiming a background cron exists.
export async function reprocessPendingEvents(limit = 50) {
  const pending = await NotificationEvent.find({ status: "pending" }).sort({ createdAt: 1 }).limit(limit);
  const results = [];
  for (const event of pending) {
    try {
      const listeners = bus.listeners(event.eventType);
      for (const listener of listeners) await listener(event.payload, event);
      event.status = "processed";
      event.processedAt = new Date();
      await event.save();
      results.push({ eventId: event.eventId, status: "processed" });
    } catch (err) {
      event.error = err.message;
      await event.save();
      results.push({ eventId: event.eventId, status: "failed", error: err.message });
    }
  }
  return results;
}

export default { publish, subscribe, reprocessPendingEvents };
