import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import { getDashboard } from "../controllers/adminDashboardController.js";

const router = Router();
router.use(protect, adminOnly, requirePermission("analytics.read"));
router.get("/", getDashboard);

export default router;
