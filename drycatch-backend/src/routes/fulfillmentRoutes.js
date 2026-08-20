import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  postCreateFulfillment, getFulfillment, listFulfillments,
  postAllocate, postStartPicking, postStartPacking, postMarkReadyToShip,
} from "../controllers/fulfillmentController.js";

// Mounted at /api/v1/admin/fulfillments — internal/admin concern end to
// end, same convention as inventoryRoutes.js.
const router = Router();
router.use(protect, adminOnly);

router.get("/", listFulfillments);
router.post("/", postCreateFulfillment);
router.get("/:id", getFulfillment);
router.post("/:id/allocate", postAllocate);
router.post("/:id/pick", postStartPicking);
router.post("/:id/pack", postStartPacking);
router.post("/:id/ready", postMarkReadyToShip);

export default router;
