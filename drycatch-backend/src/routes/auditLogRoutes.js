import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import { listAuditLogs } from "../controllers/auditLogController.js";

// No PATCH/DELETE route exists here at all (rule #80 — append-only, not
// merely "protected by permission").
const router = Router();
router.use(protect, adminOnly, requirePermission("administration.view_audit_logs"));
router.get("/", listAuditLogs);

export default router;
