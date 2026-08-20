import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

// Phase 22 — request IDs did NOT actually exist anywhere in this codebase
// before this file, despite Phase 18's own report claiming they did (that
// was an overstatement, corrected here). Every request gets a stable ID,
// accepted from an upstream proxy/CDN via `x-request-id` if present (so a
// future edge layer's ID is preserved end-to-end) or generated fresh
// otherwise. AsyncLocalStorage makes it available to any code running
// within the request — including the logger — without threading `req`
// through every function call.
const als = new AsyncLocalStorage();

export function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  // tenantId starts undefined and is filled in by tenantContext.js once
  // the tenant is resolved — mutating this same store object (rather than
  // nesting a second als.run) keeps requestId/tenantId together in one
  // place for the logger/metrics to read (Phase 25).
  als.run({ requestId, tenantId: undefined }, next);
}

// Read from anywhere (e.g. the logger, a service function) without needing
// `req` passed down explicitly — returns undefined outside a request
// (e.g. a boot-time script), which callers must handle.
export function getRequestId() {
  return als.getStore()?.requestId;
}

export function getTenantId() {
  return als.getStore()?.tenantId;
}

export function setTenantId(tenantId) {
  const store = als.getStore();
  if (store) store.tenantId = tenantId;
}
