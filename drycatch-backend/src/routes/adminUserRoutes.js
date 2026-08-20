import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import { postInvite, postAcceptInvite, listAdminUsers, patchAdminRole, postDeactivate } from "../controllers/adminUserController.js";

const router = Router();

// Accept-invite has no session yet (the invite token IS the credential) —
// rate-limited against token-guessing, same shape as the auth limiter.
const acceptInviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post("/accept-invite", acceptInviteLimiter, postAcceptInvite);

router.use(protect, adminOnly, requirePermission("administration.manage_admins"));
router.get("/", listAdminUsers);
router.post("/invite", postInvite);
router.patch("/:id/role", patchAdminRole);
router.post("/:id/deactivate", postDeactivate);

export default router;
