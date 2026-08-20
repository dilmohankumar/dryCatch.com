// Global defense-in-depth against NoSQL operator injection (Phase 18,
// rule #33/#34) — strips any object key that is a Mongo operator (starts
// with "$") or contains "." from req.body/req.params/req.query, recursively.
// This is a second layer behind explicit type-checks at individual call
// sites (e.g. authController.login) — those checks are the actual fix for
// the vulnerability found there; this middleware exists so the same class
// of bug in a future/overlooked endpoint doesn't silently become exploitable.
function stripDangerousKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) stripDangerousKeys(item);
    return value;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete value[key];
        continue;
      }
      stripDangerousKeys(value[key]);
    }
  }
  return value;
}

export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === "object") stripDangerousKeys(req.body);
  // req.query/req.params are read-only getters in some Express 5 setups —
  // mutate the object in place (delete/assign on existing keys) rather than
  // reassigning req.query itself, and never let a mutation failure here
  // block the request.
  try {
    if (req.query && typeof req.query === "object") stripDangerousKeys(req.query);
  } catch {
    /* best-effort — body sanitization above is the primary protection */
  }
  try {
    if (req.params && typeof req.params === "object") stripDangerousKeys(req.params);
  } catch {
    /* same as above */
  }
  next();
}
