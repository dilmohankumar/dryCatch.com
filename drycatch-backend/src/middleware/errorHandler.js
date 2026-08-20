import { logger, serializeError } from "../utils/logger.js";

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}`, requestId: req.requestId });
}

// Recognize Mongo/Mongoose driver-level errors and translate them into
// clean, customer-safe 4xx responses instead of ever letting a raw
// "E11000 duplicate key ..." or CastError message reach a client.
function normalizeDbError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "value";
    return { statusCode: 409, message: `That ${field.replace(/^variants\./, "")} is already in use.` };
  }
  if (err.name === "CastError") {
    return { statusCode: 400, message: "Invalid ID format." };
  }
  if (err.name === "ValidationError") {
    return { statusCode: 400, message: Object.values(err.errors).map((e) => e.message).join(", ") };
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const dbError = normalizeDbError(err);
  const status = dbError?.statusCode || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  // Structured, redacted, requestId-correlated (Phase 22) — replaces the
  // previous bare `console.error(JSON.stringify(...))`, which had no
  // requestId to correlate with (none existed anywhere in this codebase
  // before this phase) and no redaction if an error object ever happened
  // to carry a sensitive field.
  logger.error(err.message || "Unhandled error", {
    method: req.method,
    path: req.originalUrl,
    status,
    requestId: req.requestId,
    ...serializeError(err),
    stack: isProd ? undefined : err.stack,
  });

  // Never leak internal error details (e.g. DB/driver messages) to clients in prod.
  const message = dbError
    ? dbError.message
    : !isProd || status < 500
    ? err.message || "Server error"
    : "Something went wrong";

  // Structured fields (code, issues) are attached deliberately by service-layer
  // errors (e.g. checkoutService's REVALIDATION_FAILED/CHECKOUT_EXPIRED) for the
  // client to branch on — only safe to forward on 4xx, since 5xx internals are
  // never meant to reach the client at all. requestId is always safe and
  // useful to return — it's how a customer's bug report becomes traceable
  // to the exact server-side log line (rule #54's "alert content"
  // principle applied to error responses too).
  const body = { message, requestId: req.requestId };
  if (status < 500) {
    if (err.code && !dbError) body.code = err.code;
    if (err.issues) body.issues = err.issues;
  }
  res.status(status).json(body);
}
