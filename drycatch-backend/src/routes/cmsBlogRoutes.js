import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import {
  listBlogPosts, getBlogPost, createBlogPost, updateBlogPost, submitForReview, approve, publish, schedule,
  archive, restore, listRevisions, restoreRevision, runScheduler,
} from "../controllers/cms/blogAdminController.js";

const router = Router();
router.use(protect, adminOnly);

router.get("/", requirePermission("cms.blog.read"), listBlogPosts);
router.post("/", requirePermission("cms.blog.create"), createBlogPost);
router.post("/run-scheduler", requirePermission("cms.blog.publish"), runScheduler);
router.get("/:id", requirePermission("cms.blog.read"), getBlogPost);
router.patch("/:id", requirePermission("cms.blog.update"), updateBlogPost);
router.post("/:id/submit-review", requirePermission("cms.blog.update"), submitForReview);
router.post("/:id/approve", requirePermission("cms.blog.publish"), approve);
router.post("/:id/publish", requirePermission("cms.blog.publish"), publish);
router.post("/:id/schedule", requirePermission("cms.blog.publish"), schedule);
router.post("/:id/archive", requirePermission("cms.blog.delete"), archive);
router.post("/:id/restore", requirePermission("cms.blog.update"), restore);
router.get("/:id/revisions", requirePermission("cms.blog.read"), listRevisions);
router.post("/:id/revisions/:version/restore", requirePermission("cms.blog.update"), restoreRevision);

export default router;
