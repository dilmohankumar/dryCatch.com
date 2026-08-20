import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import { listRoles, createRole, updateRole, deleteRole } from "../controllers/roleController.js";

// Mounted at /api/v1/admin/roles — administration.manage_roles is granted
// only to SUPER_ADMIN/ADMIN by default (see utils/rbac.js#DEFAULT_ROLES),
// making this the one place a narrower role (CATALOG_MANAGER, etc.) is
// structurally locked out even though they pass the coarse `adminOnly`
// gate — the actual demonstration of rule #9's "prefer can()" principle.
const router = Router();
router.use(protect, adminOnly);

router.get("/", requirePermission("administration.manage_roles"), listRoles);
router.post("/", requirePermission("administration.manage_roles"), createRole);
router.patch("/:id", requirePermission("administration.manage_roles"), updateRole);
router.delete("/:id", requirePermission("administration.manage_roles"), deleteRole);

export default router;
