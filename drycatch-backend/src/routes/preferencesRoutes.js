import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getPreferences, updatePreferences } from "../controllers/preferencesController.js";

const router = Router();

router.use(protect);
router.get("/", getPreferences);
router.patch("/", updatePreferences);

export default router;
