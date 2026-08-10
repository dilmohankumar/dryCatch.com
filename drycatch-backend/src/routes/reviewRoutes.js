import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getReviewsByProduct,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
} from "../controllers/reviewController.js";

const router = Router();

router.get("/product/:productId", getReviewsByProduct);
router.post("/", protect, createReview);
router.put("/:id", protect, updateReview);
router.delete("/:id", protect, deleteReview);
router.put("/:id/helpful", protect, markHelpful);

export default router;
