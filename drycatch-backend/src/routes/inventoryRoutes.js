import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  getInventoryList,
  getInventoryForVariant,
  postAdjustStock,
  postReceiveStock,
  getMovements,
} from "../controllers/inventoryController.js";

// Mounted at /api/v1/admin/inventory — inventory is an internal/admin
// concern end to end; customers only ever see the public availability
// endpoint nested under products/variants (see variantRoutes.js).
const router = Router();

router.use(protect, adminOnly);

router.get("/", getInventoryList);
router.get("/movements", getMovements);
router.get("/:variantId", getInventoryForVariant);
router.post("/adjust", postAdjustStock);
router.post("/receive", postReceiveStock);

export default router;
