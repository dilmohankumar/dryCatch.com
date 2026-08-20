// Minimal structured audit log for sensitive account events — logs to
// console (picked up by whatever log aggregator wraps the process) rather
// than a dedicated collection, matching the "don't over-engineer" scope of
// this pass. Never pass secrets/tokens/passwords as `meta`.
export function logAuditEvent(type, userId, meta = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      audit: type,
      userId: String(userId),
      ...meta,
    })
  );
}
