import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { createCoupon, listCoupons, activateCoupon, pauseCoupon } from "../controllers/promotionController.js";

// Mounted at /api/v1/admin/coupons.
const router = Router();
router.use(protect, adminOnly);

router.get("/", listCoupons);
router.post("/", createCoupon);
router.post("/:id/activate", activateCoupon);
router.post("/:id/pause", pauseCoupon);

export default router;
