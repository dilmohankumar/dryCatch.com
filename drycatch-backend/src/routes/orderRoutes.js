import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { getOrderShipments } from "../controllers/shipmentController.js";
import {
  createOrder,
  verifyPayment,
  retryPayment,
  getPaymentStatus,
  getMyOrders,
  getOrderById,
  getOrderTimeline,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = Router();

router.use(protect);

router.get("/my-orders", getMyOrders);
router.post("/verify", verifyPayment);
router.post("/:id/retry-payment", retryPayment);
router.get("/:id/payment-status", getPaymentStatus);
router.put("/:id/cancel", cancelOrder);
router.put("/:id/status", adminOnly, updateOrderStatus);
router.get("/:id/timeline", getOrderTimeline);
router.get("/:orderId/shipments", getOrderShipments);
router.get("/:id", getOrderById);

router.get("/", adminOnly, getAllOrders);
router.post("/", createOrder);

export default router;
