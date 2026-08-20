import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import * as c from "../controllers/admin/growthAdminController.js";

// Mounted at /api/v1/admin/growth.
const router = Router();
router.use(protect, adminOnly);

router.get("/flags", requirePermission("growth.flags.read"), c.listFlags);
router.post("/flags", requirePermission("growth.flags.manage"), c.createFlag);
router.patch("/flags/:id", requirePermission("growth.flags.manage"), c.updateFlag);

router.get("/loyalty/:userId", requirePermission("growth.loyalty.read"), c.getCustomerLoyalty);
router.post("/loyalty/:userId/adjust", requirePermission("growth.loyalty.manage"), c.adjustCustomerLoyalty);

router.get("/referrals", requirePermission("growth.referrals.read"), c.listReferrals);
router.post("/referrals/:id/reject", requirePermission("growth.referrals.manage"), c.rejectReferral);

router.post("/abandoned-cart/sweep", requirePermission("growth.abandoned_cart.trigger"), c.triggerAbandonedCartSweep);

export default router;
