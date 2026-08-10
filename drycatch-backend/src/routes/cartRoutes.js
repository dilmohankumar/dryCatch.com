import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from "../controllers/cartController.js";

const router = Router();

router.use(protect);
router.get("/", getCart);
router.post("/add", addToCart);
router.put("/:productId", updateCartItem);
router.delete("/:productId", removeFromCart);
router.delete("/", clearCart);

export default router;
