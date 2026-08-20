import { getRequestId, getTenantId } from "../middleware/requestContext.js";

// Phase 22 — the one structured-logging utility for this codebase. Not a
// retroactive rewrite of every existing `console.log`/`console.error` call
// (that would be a large, unjustified sweep across 21 phases of working
// code — change-minimization principle, same reasoning as Phase 21's
// config module). New code and the request lifecycle (errorHandler,
// requestLogger below) use this; pre-existing scattered console calls are
// documented as technical debt in docs/observability.md, not silently
// migrated.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

// Fields redacted anywhere they appear in a logged object, at any nesting
// depth (rule #13) — case-insensitive substring match on the key name
// catches `password`, `newPassword`, `refreshToken`, `Authorization`, etc.
// without needing an exhaustive exact-name list.
// Deliberately specific fragments, not bare substrings like "card" — a
// naive `/card/i` would false-positive-redact unrelated fields such as
// `discardedAt`. Each fragment here only appears in a genuinely sensitive
// field name.
const REDACT_KEY_PATTERN = /password|token|secret|authorization|cookie|cvv|cardnumber|apikey|otp/i;

function redact(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
      out[key] = REDACT_KEY_PATTERN.test(normalizedKey) ? "[REDACTED]" : redact(val, seen);
    }
    return out;
  }
  return value;
}

function write(level, message, context = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "drycatch-backend",
    environment: process.env.NODE_ENV || "development",
    requestId: getRequestId(),
    // Phase 25 — undefined for platform-level requests (no tenant
    // resolved), present for every tenant-scoped request. Lets log
    // aggregation filter/alert per-tenant (rule #65/#66) without a
    // separate logging pipeline per tenant.
    tenantId: getTenantId(),
    message,
    ...redact(context),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export { redact };

export const logger = {
  debug: (message, context) => write("debug", message, context),
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
  fatal: (message, context) => write("fatal", message, context),
};

// Standardized error serialization (rule #12) — every field a debugging
// engineer actually needs, never a raw stack trace handed to a client
// (that's errorHandler's job to withhold; this is just what gets logged
// server-side).
export function serializeError(err) {
  return {
    errorType: err.name || "Error",
    errorMessage: err.message,
    errorCode: err.code,
    statusCode: err.statusCode,
    stack: err.stack,
  };
}
