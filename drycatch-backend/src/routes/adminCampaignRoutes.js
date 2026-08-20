import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import * as c from "../controllers/admin/notificationAdminController.js";

// Mounted at /api/v1/admin/campaigns. `campaigns.send` is checked
// separately from `campaigns.create`/update (rule #107) — see
// routes for /:id/send.
const router = Router();
router.use(protect, adminOnly);

router.get("/", requirePermission("notifications.read"), c.listCampaigns);
router.post("/", requirePermission("notifications.campaigns.create"), c.createCampaign);
router.patch("/:id", requirePermission("notifications.campaigns.create"), c.updateCampaign);
router.post("/:id/schedule", requirePermission("notifications.campaigns.create"), c.scheduleCampaign);
router.post("/:id/pause", requirePermission("notifications.campaigns.create"), c.pauseCampaign);
router.post("/:id/send", requirePermission("notifications.campaigns.send"), c.sendCampaignNow);
router.get("/:id/analytics", requirePermission("notifications.analytics.read"), c.getCampaignAnalytics);

export default router;
