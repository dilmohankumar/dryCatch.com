import { ingestEvent } from "../services/analytics/eventIngestionService.js";

// POST /api/v1/analytics/events — public (optionalAuth), rate-limited at
// the route layer. Behavioral event ingestion (rule #57) is deliberately
// tolerant: a bad client payload never surfaces a 500, it's routed to the
// DLQ and acknowledged (rule #113 — reject malformed events, but never let
// ingestion become a way to break the storefront).
export async function trackEvent(req, res) {
  const result = await ingestEvent(req.body, { userId: req.user?._id });
  res.status(result.accepted ? 202 : 400).json(result);
}

export async function trackEventBatch(req, res) {
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 50) : []; // rule #130 — bounded batch size
  const results = [];
  for (const event of events) results.push(await ingestEvent(event, { userId: req.user?._id }));
  res.status(202).json({ results });
}
