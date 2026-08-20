import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { requireTenant } from "../middleware/tenantContext.js";
import { requireTenantPermission } from "../utils/rbac.js";
import * as c from "../controllers/tenantController.js";

// Mounted at /api/v1/tenant — every route here is reached via the
// tenant's own domain/subdomain (requireTenant resolves it from the
// Host header, rule #10), never via a client-supplied tenantId.
const router = Router();

router.get("/slug-availability", c.checkSlugAvailable); // platform-level (signup flow) — no tenant context needed

router.use(requireTenant);
router.get("/", c.getCurrentTenant);

router.use(protect);
router.patch("/settings/:category", requireTenantPermission("settings.update"), c.updateSettings);

router.get("/memberships/mine", c.myMemberships);
router.post("/memberships/accept", c.acceptInvite);
router.get("/team", requireTenantPermission("team.read"), c.listMembers);
router.post("/team/invite", requireTenantPermission("team.manage"), c.inviteMember);
router.delete("/team/:id", requireTenantPermission("team.manage"), c.revokeMember);

router.get("/domains", requireTenantPermission("domains.read"), c.listDomains);
router.post("/domains", requireTenantPermission("domains.manage"), c.addDomain);
router.post("/domains/:id/verify", requireTenantPermission("domains.manage"), c.verifyDomain);
router.post("/domains/:id/set-primary", requireTenantPermission("domains.manage"), c.setPrimaryDomain);
router.delete("/domains/:id", requireTenantPermission("domains.manage"), c.removeDomain);

export default router;
