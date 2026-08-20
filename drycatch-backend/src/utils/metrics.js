import client from "prom-client";

// Phase 22 — RED method for HTTP (rule #19), USE method groundwork for
// infra (rule #20). Uses `prom-client` (the de facto standard Node
// Prometheus client) rather than a hand-rolled histogram implementation —
// standardized exposition format any future scraper (Prometheus, Grafana
// Cloud, Datadog's Prometheus receiver, etc.) can ingest without this
// codebase committing to a specific vendor (rule #80's "keep
// instrumentation portable").
client.collectDefaultMetrics({ prefix: "drycatch_" }); // process CPU/memory/event-loop-lag — the USE-method process-level signals

// route (not path) is the label — Express's matched route pattern
// (e.g. "/api/v1/orders/:id"), never the raw URL. Using the raw URL would
// make orderId part of the label set, which is exactly the unbounded
// high-cardinality metric label rule #17/#63 explicitly forbids.
export const httpRequestDuration = new client.Histogram({
  name: "drycatch_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_class"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestsTotal = new client.Counter({
  name: "drycatch_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_class"],
});

export const httpErrorsTotal = new client.Counter({
  name: "drycatch_http_errors_total",
  help: "Total HTTP 5xx responses",
  labelNames: ["method", "route"],
});

// Business-signal counters (rule #38) — separate from the analytics
// dashboards Phase 17 built (those answer "how is the business doing over
// a date range"; these answer "is the checkout/payment/webhook pipeline
// healthy right now," an operational question, not a business one).
export const checkoutOutcomeTotal = new client.Counter({
  name: "drycatch_checkout_outcome_total",
  help: "Checkout attempts by outcome",
  labelNames: ["outcome"], // "started" | "order_created" | "validation_failed" | "payment_failed"
});

export const paymentOutcomeTotal = new client.Counter({
  name: "drycatch_payment_outcome_total",
  help: "Payment attempts by outcome",
  labelNames: ["outcome", "provider"], // "succeeded" | "failed"
});

export const webhookOutcomeTotal = new client.Counter({
  name: "drycatch_webhook_outcome_total",
  help: "Webhook events by outcome",
  labelNames: ["provider", "outcome"], // "processed" | "duplicate" | "invalid_signature" | "ignored"
});

export const inventoryReservationOutcomeTotal = new client.Counter({
  name: "drycatch_inventory_reservation_outcome_total",
  help: "Inventory reservation attempts by outcome",
  labelNames: ["outcome"], // "reserved" | "insufficient_stock"
});

function statusClass(status) {
  return `${Math.floor(status / 100)}xx`;
}

// Route-pattern-based labeling (rule #17) — req.route.path is the matched
// Express pattern ("/:id" etc.); combined with the mount path via
// baseUrl+route.path so nested routers still produce a bounded label like
// "/api/v1/orders/:id", never the literal requested URL.
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route ? `${req.baseUrl}${req.route.path}` : `${req.baseUrl || req.path}(unmatched)`;
    const labels = { method: req.method, route, status_class: statusClass(res.statusCode) };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
    if (res.statusCode >= 500) httpErrorsTotal.inc({ method: req.method, route });
  });
  next();
}

export { client as metricsRegistry };
