import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import {
  listPages, getPage, getHomepage, createPage, updatePage, submitForReview, approve, publish, schedule,
  archive, restore, sendBackToDraft, duplicatePage, listRevisions, restoreRevision, runScheduler,
} from "../controllers/cms/pageAdminController.js";

// Mounted at /api/v1/admin/cms/pages — publish is gated by a SEPARATE
// permission (cms.pages.publish) from read/create/update (rule #71) —
// a CONTENT_WRITER can pass every other route here and still 403 on
// /:id/publish specifically.
const router = Router();
router.use(protect, adminOnly);

router.get("/", requirePermission("cms.pages.read"), listPages);
router.get("/homepage", requirePermission("cms.pages.read"), getHomepage);
router.post("/", requirePermission("cms.pages.create"), createPage);
router.post("/run-scheduler", requirePermission("cms.pages.publish"), runScheduler);
router.get("/:id", requirePermission("cms.pages.read"), getPage);
router.patch("/:id", requirePermission("cms.pages.update"), updatePage);
router.post("/:id/duplicate", requirePermission("cms.pages.create"), duplicatePage);
router.post("/:id/submit-review", requirePermission("cms.pages.update"), submitForReview);
router.post("/:id/approve", requirePermission("cms.pages.publish"), approve);
router.post("/:id/publish", requirePermission("cms.pages.publish"), publish);
router.post("/:id/schedule", requirePermission("cms.pages.publish"), schedule);
router.post("/:id/archive", requirePermission("cms.pages.delete"), archive);
router.post("/:id/restore", requirePermission("cms.pages.update"), restore);
router.post("/:id/send-back", requirePermission("cms.pages.update"), sendBackToDraft);
router.get("/:id/revisions", requirePermission("cms.pages.read"), listRevisions);
router.post("/:id/revisions/:version/restore", requirePermission("cms.pages.update"), restoreRevision);

export default router;
