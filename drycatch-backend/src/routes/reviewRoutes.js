import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, optionalAuth } from "../middleware/auth.js";
import {
  getMyReviews, getReview, patchReview, deleteReview, postVote, deleteVote, postReport,
} from "../controllers/reviewController.js";

// Mounted at /api/v1/reviews — id-based review operations. Product-scoped
// create/list/summary live in productReviewRoutes.js.
const router = Router();

// Review mutation endpoints are a spam/abuse target (rule #89/#90) —
// throttled tighter than the blanket apiLimiter, same shape as the coupon
// limiter from Phase 11.
const reviewActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

router.get("/my", protect, getMyReviews);
router.get("/:id", optionalAuth, getReview); // public if published; owner/admin can see their own non-published one
router.patch("/:id", protect, reviewActionLimiter, patchReview);
router.delete("/:id", protect, deleteReview);
router.post("/:id/vote", protect, reviewActionLimiter, postVote);
router.delete("/:id/vote", protect, deleteVote);
router.post("/:id/report", protect, reviewActionLimiter, postReport);

export default router;
