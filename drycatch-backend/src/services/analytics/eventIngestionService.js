import crypto from "crypto";
import AnalyticsEvent from "../../models/AnalyticsEvent.js";
import AnalyticsEventDLQ from "../../models/AnalyticsEventDLQ.js";
import { BEHAVIORAL_EVENT_TYPES, CURRENT_SCHEMA_VERSION } from "../../utils/analyticsEvents.js";
import { processBehavioralEvent } from "./analyticsWorker.js";

const DEVICE_VALUES = new Set(["desktop", "mobile", "tablet", "other"]);

// Validate-before-processing (rule #113): a malformed event never reaches
// AnalyticsEvent/an aggregate. Rejected events go to the DLQ with a reason,
// not silently dropped (rule #114).
function validate(payload) {
  if (!payload || typeof payload !== "object") return "payload is not an object";
  if (!payload.eventType || !BEHAVIORAL_EVENT_TYPES.has(payload.eventType)) return `unknown eventType "${payload.eventType}"`;
  if (!payload.timestamp || Number.isNaN(new Date(payload.timestamp).getTime())) return "missing/invalid timestamp";
  if (!payload.userId && !payload.anonymousId) return "one of userId/anonymousId is required";
  if (payload.schemaVersion !== undefined && payload.schemaVersion > CURRENT_SCHEMA_VERSION) return `unsupported schemaVersion ${payload.schemaVersion}`;
  return null;
}

// Ingests one client-reported event. Idempotent: a duplicate eventId
// (retried by a flaky client) hits the unique index and is treated as a
// no-op success, never a second aggregate increment (rule #61).
export async function ingestEvent(rawPayload, context = {}) {
  const invalidReason = validate(rawPayload);
  if (invalidReason) {
    await AnalyticsEventDLQ.create({ rawPayload, reason: invalidReason });
    return { accepted: false, reason: invalidReason };
  }

  const eventId = rawPayload.eventId || crypto.randomUUID();
  const doc = {
    eventId,
    eventType: rawPayload.eventType,
    userId: context.userId || rawPayload.userId || undefined,
    anonymousId: rawPayload.anonymousId,
    sessionId: rawPayload.sessionId,
    timestamp: new Date(rawPayload.timestamp),
    source: rawPayload.source || "web",
    device: DEVICE_VALUES.has(rawPayload.device) ? rawPayload.device : "other",
    page: typeof rawPayload.page === "string" ? rawPayload.page.slice(0, 500) : undefined,
    properties: sanitizeProperties(rawPayload.properties),
    schemaVersion: rawPayload.schemaVersion || CURRENT_SCHEMA_VERSION,
    utm: rawPayload.utm,
  };

  let event;
  try {
    event = await AnalyticsEvent.create(doc);
  } catch (err) {
    if (err.code === 11000) return { accepted: true, duplicate: true }; // rule #61 — already processed, not an error
    throw err;
  }

  await processBehavioralEvent(event);
  return { accepted: true, eventId };
}

// Never store arbitrary nested objects/functions from the client — a flat,
// small set of primitive values only (rule #58's "not a full document").
function sanitizeProperties(properties) {
  if (!properties || typeof properties !== "object") return {};
  const clean = {};
  for (const [key, value] of Object.entries(properties)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) clean[key] = value;
  }
  return clean;
}
