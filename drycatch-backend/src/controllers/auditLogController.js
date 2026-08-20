import * as adminAuditService from "../services/admin/adminAuditService.js";

// GET /admin/audit-logs?actor=&action=&entityType=&entityId=&page=&limit=
export async function listAuditLogs(req, res) {
  res.json(await adminAuditService.listAuditLogs(req.query));
}
