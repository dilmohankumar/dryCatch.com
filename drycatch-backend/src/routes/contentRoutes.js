import { Router } from "express";
import {
  getPage, getHomepage, getBlogPost, listBlogPosts, getFAQs, getNavigation, getFooter, getBanners,
} from "../controllers/contentController.js";
import * as bannerService from "../services/cms/bannerService.js";

// Mounted at /api/v1/content — fully public, no auth, published-only.
const router = Router();

router.get("/homepage", getHomepage);
router.get("/pages/:slug", getPage);
router.get("/blog", listBlogPosts);
router.get("/blog/:slug", getBlogPost);
router.get("/faqs", getFAQs);
router.get("/navigation/:name", getNavigation);
router.get("/footer", getFooter);
router.get("/banners", getBanners);

// Server-side impression/click counters (rule #93) — never trusted from
// frontend UI state alone; the storefront calls these when a banner
// actually renders/is clicked.
router.post("/banners/:id/impression", async (req, res) => { await bannerService.trackImpression(req.params.id); res.json({ ok: true }); });
router.post("/banners/:id/click", async (req, res) => { await bannerService.trackClick(req.params.id); res.json({ ok: true }); });

export default router;
