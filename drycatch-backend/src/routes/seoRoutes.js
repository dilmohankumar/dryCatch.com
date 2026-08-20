import { Router } from "express";
import { getRobotsTxt, getSitemapIndex, getSitemapChunk } from "../services/seo/sitemapService.js";

// Mounted at the app root (not under /api/v1) — robots.txt/sitemap.xml
// are expected at fixed, well-known paths by every crawler, never a
// versioned API path.
const router = Router();

router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(getRobotsTxt());
});

router.get("/sitemap.xml", async (req, res) => {
  res.type("application/xml").send(await getSitemapIndex());
});

router.get("/sitemaps/:sectionChunk.xml", async (req, res) => {
  const match = req.params.sectionChunk.match(/^([a-z]+)-(\d+)$/);
  if (!match) return res.status(404).end();
  const [, section, index] = match;
  const xml = await getSitemapChunk(section, Number(index));
  if (!xml) return res.status(404).end();
  res.type("application/xml").send(xml);
});

export default router;
