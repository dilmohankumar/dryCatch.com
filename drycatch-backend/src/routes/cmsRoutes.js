import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import * as c from "../controllers/cms/cmsMiscController.js";

// Mounted at /api/v1/admin/cms — everything except media upload/navigation/
// footer/faq/banner/redirect/seo management that doesn't fit the
// pages/blog lifecycle shape.
const router = Router();
router.use(protect, adminOnly);

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });

router.get("/media", requirePermission("cms.pages.read"), c.listMedia);
router.get("/media/orphaned", requirePermission("cms.pages.read"), c.listOrphanedMedia);
router.post("/media", requirePermission("cms.media.upload"), uploadLimiter, c.uploadMedia);
router.delete("/media/:id", requirePermission("cms.media.delete"), c.deleteMedia);

router.get("/navigation", requirePermission("cms.pages.read"), c.listMenus);
router.get("/navigation/:name", requirePermission("cms.pages.read"), c.getMenu);
router.put("/navigation/:name", requirePermission("cms.navigation.update"), c.updateMenu);

router.get("/footer", requirePermission("cms.pages.read"), c.getFooter);
router.put("/footer", requirePermission("cms.navigation.update"), c.updateFooter);

router.get("/faqs", requirePermission("cms.pages.read"), c.listFAQs);
router.post("/faqs", requirePermission("cms.pages.create"), c.createFAQ);
router.patch("/faqs/:id", requirePermission("cms.pages.update"), c.updateFAQ);
router.delete("/faqs/:id", requirePermission("cms.pages.delete"), c.deleteFAQ);

router.get("/banners", requirePermission("cms.pages.read"), c.listBanners);
router.post("/banners", requirePermission("cms.pages.create"), c.createBanner);
router.patch("/banners/:id", requirePermission("cms.pages.update"), c.updateBanner);
router.delete("/banners/:id", requirePermission("cms.pages.delete"), c.deleteBanner);

router.get("/redirects", requirePermission("cms.redirects.manage"), c.listRedirects);
router.get("/redirects/resolve", requirePermission("cms.redirects.manage"), c.resolveRedirect);
router.post("/redirects", requirePermission("cms.redirects.manage"), c.createRedirect);
router.patch("/redirects/:id", requirePermission("cms.redirects.manage"), c.updateRedirect);
router.delete("/redirects/:id", requirePermission("cms.redirects.manage"), c.deleteRedirect);

router.get("/seo", requirePermission("cms.pages.read"), c.getSEOSettings);
router.put("/seo", requirePermission("cms.seo.update"), c.updateSEOSettings);

export default router;
