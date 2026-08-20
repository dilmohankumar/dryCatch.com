import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  createPromotion, listPromotions, getPromotion, updatePromotion,
  activatePromotion, pausePromotion, archivePromotion,
} from "../controllers/promotionController.js";

// Mounted at /api/v1/admin/promotions.
const router = Router();
router.use(protect, adminOnly);

router.get("/", listPromotions);
router.post("/", createPromotion);
router.get("/:id", getPromotion);
router.patch("/:id", updatePromotion);
router.post("/:id/activate", activatePromotion);
router.post("/:id/pause", pausePromotion);
router.post("/:id/archive", archivePromotion);

export default router;
