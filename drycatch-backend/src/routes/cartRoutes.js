import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { identifyCart } from "../middleware/cartIdentity.js";
import { getCart, postAddItem, patchItem, deleteItem, deleteCart } from "../controllers/cartController.js";

// Cart works for guests AND logged-in users — optionalAuth never rejects,
// identifyCart resolves req.cartIdentity to exactly one of {userId}/{guestId}.
const router = Router();
router.use(optionalAuth, identifyCart);

router.get("/", getCart);
router.post("/items", postAddItem);
router.patch("/items/:itemId", patchItem);
router.delete("/items/:itemId", deleteItem);
router.delete("/", deleteCart);

export default router;
