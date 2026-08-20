import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { listWarehouses, createWarehouse } from "../controllers/warehouseController.js";

const router = Router();
router.use(protect, adminOnly);

router.get("/", listWarehouses);
router.post("/", createWarehouse);

export default router;
