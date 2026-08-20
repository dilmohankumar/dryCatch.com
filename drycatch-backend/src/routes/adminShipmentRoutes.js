import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  postCreateShipment, postGenerateLabel, postCancelShipment, postPollShipment, listShipmentsAdmin,
} from "../controllers/shipmentController.js";

// Mounted at /api/v1/admin/shipments.
const router = Router();
router.use(protect, adminOnly);

router.get("/", listShipmentsAdmin);
router.post("/", postCreateShipment);
router.post("/:id/label", postGenerateLabel);
router.post("/:id/cancel", postCancelShipment);
router.post("/:id/poll", postPollShipment);

export default router;
