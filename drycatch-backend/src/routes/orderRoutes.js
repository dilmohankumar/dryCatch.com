import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = Router();

router.use(protect);

router.get("/my-orders", getMyOrders);
router.post("/verify", verifyPayment);
router.put("/:id/cancel", cancelOrder);
router.put("/:id/status", adminOnly, updateOrderStatus);
router.get("/:id", getOrderById);

router.get("/", adminOnly, getAllOrders);
router.post("/", createOrder);

export default router;
