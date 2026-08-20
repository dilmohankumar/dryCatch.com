import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  listReviews, getReview, patchReviewStatus, patchFeatured, listReports, patchReport,
} from "../controllers/adminReviewController.js";

// Mounted at /api/v1/admin/reviews and /api/v1/admin/review-reports.
const router = Router();
router.use(protect, adminOnly);

router.get("/", listReviews);
router.get("/:id", getReview);
router.patch("/:id/status", patchReviewStatus);
router.patch("/:id/featured", patchFeatured);

export default router;

export const reportsRouter = Router();
reportsRouter.use(protect, adminOnly);
reportsRouter.get("/", listReports);
reportsRouter.patch("/:id", patchReport);
