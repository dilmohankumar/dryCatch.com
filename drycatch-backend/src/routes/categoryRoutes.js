import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requireFields } from "../middleware/validate.js";
import {
  getCategories,
  getCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

const router = Router();

router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);
router.get("/", getCategories);

router.post("/", protect, adminOnly, requireFields(["name", "slug"]), createCategory);
router.put("/:id", protect, adminOnly, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

export default router;
