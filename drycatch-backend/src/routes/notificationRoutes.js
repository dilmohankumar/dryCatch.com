import { Router } from "express";
import { protect } from "../middleware/auth.js";
import * as c from "../controllers/notificationController.js";

// Mounted at /api/v1/notifications — customer Notification Center,
// preferences, and device registration. Everything scoped to req.user.
const router = Router();
router.use(protect);

router.get("/", c.listNotifications);
router.get("/unread-count", c.getUnreadCount);
router.patch("/:id/read", c.markAsRead);
router.post("/read-all", c.markAllRead);
router.patch("/:id/archive", c.archiveNotification);

router.get("/preferences", c.getPreferences);
router.patch("/preferences", c.updatePreferences);
router.post("/unsubscribe", c.unsubscribe);

router.post("/devices", c.registerDevice);
router.get("/devices", c.listDevices);
router.delete("/devices/:deviceId", c.revokeDevice);

export default router;
