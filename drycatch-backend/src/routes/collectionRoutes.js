import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requireFields } from "../middleware/validate.js";
import {
  getCollections,
  getCollectionBySlug,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../controllers/collectionController.js";

const router = Router();

router.get("/", getCollections);
router.get("/:slug", getCollectionBySlug);

router.post("/", protect, adminOnly, requireFields(["name"]), createCollection);
router.patch("/:id", protect, adminOnly, updateCollection);
router.delete("/:id", protect, adminOnly, deleteCollection);

export default router;
