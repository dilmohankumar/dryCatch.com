import * as contentApiService from "../services/cms/contentApiService.js";

// Every function here is public and PUBLISHED-ONLY (rule #82/#83) — no
// auth, no draft ever leaks through this file.
export async function getPage(req, res) {
  res.json(await contentApiService.getPublishedPage(req.params.slug));
}
export async function getHomepage(req, res) {
  res.json(await contentApiService.getPublishedHomepage());
}
export async function getBlogPost(req, res) {
  res.json(await contentApiService.getPublishedBlogPost(req.params.slug));
}
export async function listBlogPosts(req, res) {
  res.json(await contentApiService.listPublishedBlogPosts(req.query));
}
export async function getFAQs(req, res) {
  res.json({ faqs: await contentApiService.getPublicFAQs(req.query.category) });
}
export async function getNavigation(req, res) {
  res.json(await contentApiService.getPublicNavigation(req.params.name));
}
export async function getFooter(req, res) {
  res.json(await contentApiService.getPublicFooter());
}
export async function getBanners(req, res) {
  res.json({ banners: await contentApiService.getPublicBanners(req.query.target, req.query.targetId) });
}
