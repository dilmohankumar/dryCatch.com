import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getShipment, getShipmentTracking } from "../controllers/shipmentController.js";

// Mounted at /api/v1/shipments — customer-facing (ownership checked inside
// the controller against the shipment's order.user), admin bypasses via
// role check in the same controller rather than a separate route tree.
const router = Router();
router.use(protect);

router.get("/:id", getShipment);
router.get("/:id/tracking", getShipmentTracking);

export default router;
