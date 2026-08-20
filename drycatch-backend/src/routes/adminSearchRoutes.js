import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import {
  listSynonyms, createSynonym, updateSynonym, deleteSynonym,
  listRules, createRule, updateRule, deleteRule,
  postReindex, postReconcile, getHealth, getAnalytics,
} from "../controllers/adminSearchController.js";

// Mounted at /api/v1/admin/search.
const router = Router();
router.use(protect, adminOnly);

router.get("/synonyms", listSynonyms);
router.post("/synonyms", createSynonym);
router.patch("/synonyms/:id", updateSynonym);
router.delete("/synonyms/:id", deleteSynonym);

router.get("/rules", listRules);
router.post("/rules", createRule);
router.patch("/rules/:id", updateRule);
router.delete("/rules/:id", deleteRule);

router.post("/reindex", postReindex);
router.post("/reconcile", postReconcile);
router.get("/health", getHealth);
router.get("/analytics", getAnalytics);

export default router;
