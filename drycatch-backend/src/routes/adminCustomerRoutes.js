import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import { listCustomers, postBlock, postUnblock } from "../controllers/adminCustomerController.js";

const router = Router();
router.use(protect, adminOnly, requirePermission("customers.read"));

router.get("/", listCustomers);
router.post("/:id/block", requirePermission("customers.block"), postBlock);
router.post("/:id/unblock", requirePermission("customers.block"), postUnblock);

export default router;
