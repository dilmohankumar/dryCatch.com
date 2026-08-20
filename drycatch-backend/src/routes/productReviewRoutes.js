import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth.js";
import { postCreateReview, getProductReviews, getReviewSummary } from "../controllers/reviewController.js";

// Mounted at /api/v1/products/:productId/reviews — mergeParams so
// req.params.productId is visible in the controller.
const router = Router({ mergeParams: true });

const createReviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many review submissions, please try again later" },
});

router.get("/", getProductReviews); // public
router.get("/summary", getReviewSummary); // public
router.post("/", protect, createReviewLimiter, postCreateReview);

export default router;
