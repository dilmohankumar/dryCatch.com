import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requireFields } from "../middleware/validate.js";
import variantRoutes from "./variantRoutes.js";
import {
  getProducts,
  getFeaturedProducts,
  getProductsByCategory,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = Router();

router.use("/:productId/variants", variantRoutes);

router.get("/featured", getFeaturedProducts);
router.get("/category/:categoryId", getProductsByCategory);
router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", protect, adminOnly, requireFields(["name", "price"]), createProduct);
router.put("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
