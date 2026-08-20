import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requireFields } from "../middleware/validate.js";
import {
  getVariants,
  getVariantById,
  getVariantsAdmin,
  createVariant,
  updateVariant,
  archiveVariant,
} from "../controllers/variantController.js";
import { getPublicAvailability } from "../controllers/inventoryController.js";

// Mounted at /api/v1/products/:productId/variants (see productRoutes.js).
const router = Router({ mergeParams: true });

router.get("/", getVariants);
// Must come before "/:variantId" — otherwise "admin" would be parsed as a variantId.
router.get("/admin", protect, adminOnly, getVariantsAdmin);
router.get("/:variantId", getVariantById);
router.get("/:variantId/availability", getPublicAvailability);

router.post("/", protect, adminOnly, requireFields(["price"]), createVariant);
router.patch("/:variantId", protect, adminOnly, updateVariant);
router.delete("/:variantId", protect, adminOnly, archiveVariant);

export default router;
