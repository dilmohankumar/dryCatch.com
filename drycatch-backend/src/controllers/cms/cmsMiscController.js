import * as mediaService from "../../services/cms/mediaService.js";
import * as navigationService from "../../services/cms/navigationService.js";
import * as footerService from "../../services/cms/footerService.js";
import * as faqService from "../../services/cms/faqService.js";
import * as bannerService from "../../services/cms/bannerService.js";
import * as redirectService from "../../services/cms/redirectService.js";
import * as seoService from "../../services/cms/seoService.js";

// ---- Media ----
export async function uploadMedia(req, res) {
  res.status(201).json({ media: await mediaService.uploadMedia(req.user._id, req.body) });
}
export async function listMedia(req, res) {
  res.json(await mediaService.listMedia(req.query));
}
export async function deleteMedia(req, res) {
  res.json({ media: await mediaService.deleteMedia(req.params.id) });
}
export async function listOrphanedMedia(req, res) {
  res.json(await mediaService.listOrphanedMedia(req.query));
}

// ---- Navigation ----
export async function listMenus(req, res) {
  res.json({ menus: await navigationService.listMenus() });
}
export async function getMenu(req, res) {
  res.json({ menu: await navigationService.getMenu(req.params.name) });
}
export async function updateMenu(req, res) {
  res.json({ menu: await navigationService.updateMenu(req.params.name, req.body.items) });
}

// ---- Footer ----
export async function getFooter(req, res) {
  res.json({ footer: await footerService.getFooter() });
}
export async function updateFooter(req, res) {
  res.json({ footer: await footerService.updateFooter(req.body) });
}

// ---- FAQs ----
export async function listFAQs(req, res) {
  res.json({ faqs: await faqService.listFAQs(req.query) });
}
export async function createFAQ(req, res) {
  res.status(201).json({ faq: await faqService.createFAQ(req.user._id, req.body) });
}
export async function updateFAQ(req, res) {
  res.json({ faq: await faqService.updateFAQ(req.params.id, req.body) });
}
export async function deleteFAQ(req, res) {
  await faqService.deleteFAQ(req.params.id);
  res.json({ ok: true });
}

// ---- Banners ----
export async function listBanners(req, res) {
  res.json({ banners: await bannerService.listBanners(req.query) });
}
export async function createBanner(req, res) {
  res.status(201).json({ banner: await bannerService.createBanner(req.body) });
}
export async function updateBanner(req, res) {
  res.json({ banner: await bannerService.updateBanner(req.params.id, req.body) });
}
export async function deleteBanner(req, res) {
  await bannerService.deleteBanner(req.params.id);
  res.json({ ok: true });
}
export async function trackBannerClick(req, res) {
  await bannerService.trackClick(req.params.id);
  res.json({ ok: true });
}

// ---- Redirects ----
export async function listRedirects(req, res) {
  res.json(await redirectService.listRedirects(req.query));
}
export async function createRedirect(req, res) {
  res.status(201).json({ redirect: await redirectService.createRedirect(req.user._id, req.body) });
}
export async function updateRedirect(req, res) {
  res.json({ redirect: await redirectService.updateRedirect(req.params.id, req.body) });
}
export async function deleteRedirect(req, res) {
  await redirectService.deleteRedirect(req.params.id);
  res.json({ ok: true });
}
export async function resolveRedirect(req, res) {
  const redirect = await redirectService.resolveRedirect(req.query.path);
  res.json({ redirect: redirect || null });
}

// ---- SEO ----
export async function getSEOSettings(req, res) {
  res.json({ settings: await seoService.getSEOSettings() });
}
export async function updateSEOSettings(req, res) {
  res.json({ settings: await seoService.updateSEOSettings(req.user._id, req.body) });
}
