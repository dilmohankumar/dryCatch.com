import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePlatformPermission } from "../utils/rbac.js";
import * as c from "../controllers/platform/platformAdminController.js";

// Mounted at /api/v1/platform/admin — deliberately a SEPARATE router tree
// from /api/v1/admin/* (which is a tenant's own back office). A tenant
// Owner/Admin has no permission string that satisfies
// requirePlatformPermission, no matter how broad their tenant role is
// (rule #19/#20 — the boundary is structural, not just a UI hide).
const router = Router();
router.use(protect, adminOnly);

router.get("/tenants", requirePlatformPermission("platform.tenants.read"), c.listTenants);
router.get("/tenants/:id", requirePlatformPermission("platform.tenants.read"), c.getTenant);
router.post("/tenants", requirePlatformPermission("platform.tenants.manage"), c.createTenant);
router.post("/tenants/:id/suspend", requirePlatformPermission("platform.tenants.suspend"), c.suspendTenant);
router.post("/tenants/:id/reactivate", requirePlatformPermission("platform.tenants.suspend"), c.reactivateTenant);
router.post("/tenants/:id/request-deletion", requirePlatformPermission("platform.tenants.manage"), c.requestTenantDeletion);

export default router;
