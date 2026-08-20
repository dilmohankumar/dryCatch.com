import AdminAuditLog from "../../models/AdminAuditLog.js";

// The one place an AdminAuditLog row is ever created — every admin
// controller that touches something sensitive calls this with a
// before/after snapshot (rule #141), never writes to the collection
// directly. A failure here should never fail the underlying admin action
// (an audit-log outage shouldn't block a legitimate refund), so callers
// wrap this in `.catch(() => {})` at the call site — recording the gap in
// docs/admin.md rather than silently pretending audit logging is
// transactionally guaranteed with the action itself.
export async function recordAdminAction({ actor, action, entityType, entityId, before, after, req }) {
  return AdminAuditLog.create({
    actor,
    action,
    entityType,
    entityId,
    before,
    after,
    ip: req?.ip,
    requestId: req?.headers?.["x-request-id"],
  });
}

export async function listAuditLogs({ actor, action, entityType, entityId, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (actor) filter.actor = actor;
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("actor", "firstName lastName email"),
    AdminAuditLog.countDocuments(filter),
  ]);
  return { logs, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}
