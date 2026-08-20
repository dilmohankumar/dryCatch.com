import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import * as c from "../controllers/admin/notificationAdminController.js";

// Mounted at /api/v1/admin/notifications.
const router = Router();
router.use(protect, adminOnly);

router.get("/", requirePermission("notifications.read"), c.listAdminNotifications);
router.get("/deliveries", requirePermission("notifications.read"), c.listDeliveries);
router.get("/deliveries/:id", requirePermission("notifications.read"), c.getDeliveryDetail);
router.get("/dead-letter", requirePermission("notifications.read"), c.listDeadLetter);
router.post("/dead-letter/:id/retry", requirePermission("notifications.send"), c.retryDeadLetter);
router.post("/dead-letter/:id/cancel", requirePermission("notifications.send"), c.cancelDeadLetter);
router.post("/process-retries", requirePermission("notifications.send"), c.processRetries);
router.post("/reprocess-events", requirePermission("notifications.send"), c.reprocessPendingEvents);

router.get("/templates", requirePermission("notifications.read"), c.listTemplates);
router.post("/templates", requirePermission("notifications.templates.manage"), c.createTemplate);
router.patch("/templates/:id", requirePermission("notifications.templates.manage"), c.updateTemplate);
router.post("/templates/:id/publish", requirePermission("notifications.templates.manage"), c.publishTemplate);
router.get("/templates/:id/revisions", requirePermission("notifications.read"), c.listTemplateRevisions);
router.post("/templates/:id/revisions/:revisionId/restore", requirePermission("notifications.templates.manage"), c.restoreTemplateRevision);
router.post("/templates/:id/preview", requirePermission("notifications.read"), c.previewTemplate);

router.post("/test", requirePermission("notifications.send"), c.sendTestNotification);

router.get("/suppressions", requirePermission("notifications.read"), c.listSuppressions);
router.delete("/suppressions/:channel/:value", requirePermission("notifications.templates.manage"), c.removeSuppression);

router.get("/providers", requirePermission("notifications.providers.manage"), c.getProviderConfig);

router.get("/analytics/deliveries", requirePermission("notifications.analytics.read"), c.getDeliveryStats);
router.get("/analytics/queue-health", requirePermission("notifications.analytics.read"), c.getQueueHealth);

export default router;
