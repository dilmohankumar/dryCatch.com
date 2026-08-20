import Page from "../../models/Page.js";
import BlogPost from "../../models/BlogPost.js";
import FAQ from "../../models/FAQ.js";
import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Collection from "../../models/Collection.js";
import Banner from "../../models/Banner.js";
import MediaAsset from "../../models/MediaAsset.js";
import * as navigationService from "./navigationService.js";
import * as footerService from "./footerService.js";
import * as seoService from "./seoService.js";
import { getActiveBanners } from "./bannerService.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// The whole point of this file (rule #140/#151): resolve every commerce
// reference a page's blocks point at in a handful of BATCHED queries, not
// one query per block per product. Storefront calls ONE endpoint
// (GET /content/pages/:slug) and gets back blocks whose data already
// contains live product/category/collection/banner/FAQ objects — never a
// second round-trip per block, and never CMS's own stale copy of price/
// stock (rule #139: CMS is never the source of truth for those).
async function resolveBlocks(blocks) {
  const productIds = new Set();
  const categoryIds = new Set();
  const collectionIds = new Set();
  const bannerIds = new Set();
  const faqIds = new Set();
  const faqCategories = new Set();
  const reviewProductIds = new Set();
  // hero/image/imageText also reference MediaAsset by id — found missing
  // during frontend integration testing (banner already resolved its
  // image/mobileImage via .populate(), these three didn't, so a saved
  // MediaAsset id passed straight through unresolved to the storefront).
  // Fixed here rather than left inconsistent.
  const mediaIds = new Set();

  function collectMediaId(value) {
    if (typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value)) mediaIds.add(value);
  }

  for (const block of blocks) {
    const d = block.data || {};
    if (block.type === "productGrid" && d.mode === "manual") d.productIds?.forEach((id) => productIds.add(String(id)));
    if (block.type === "productGrid" && d.categoryId) categoryIds.add(String(d.categoryId));
    if (block.type === "productGrid" && d.collectionId) collectionIds.add(String(d.collectionId));
    if (block.type === "categoryGrid") d.categoryIds?.forEach((id) => categoryIds.add(String(id)));
    if (block.type === "collectionGrid") d.collectionIds?.forEach((id) => collectionIds.add(String(id)));
    if (block.type === "banner") bannerIds.add(String(d.bannerId));
    if (block.type === "faq") { d.faqIds?.forEach((id) => faqIds.add(String(id))); if (d.category) faqCategories.add(d.category); }
    if (block.type === "reviewSummary") reviewProductIds.add(String(d.productId));
    if (block.type === "hero") { collectMediaId(d.image); collectMediaId(d.mobileImage); }
    if (block.type === "image" || block.type === "imageText") collectMediaId(d.image);
  }

  const [products, categories, collections, banners, faqsById, faqsByCategory, reviewProducts, mediaAssets] = await Promise.all([
    productIds.size ? Product.find({ _id: { $in: [...productIds] }, status: "active" }, "name slug price mrp media rating reviewsCount") : [],
    categoryIds.size ? Category.find({ _id: { $in: [...categoryIds] }, status: "active" }, "name slug image") : [],
    collectionIds.size ? Collection.find({ _id: { $in: [...collectionIds] }, status: "active" }, "name slug image") : [],
    bannerIds.size ? Banner.find({ _id: { $in: [...bannerIds] } }).populate("image mobileImage") : [],
    faqIds.size ? FAQ.find({ _id: { $in: [...faqIds] }, status: "active" }) : [],
    faqCategories.size ? FAQ.find({ category: { $in: [...faqCategories] }, status: "active" }).sort({ order: 1 }) : [],
    reviewProductIds.size ? Product.find({ _id: { $in: [...reviewProductIds] } }, "name rating reviewsCount") : [],
    mediaIds.size ? MediaAsset.find({ _id: { $in: [...mediaIds] }, status: "ready" }) : [],
  ]);
  const mediaMap = new Map(mediaAssets.map((m) => [String(m._id), m]));
  const resolveMedia = (value) => (typeof value === "string" && mediaMap.has(value) ? mediaMap.get(value) : value);

  const productsByCategory = categoryIds.size
    ? await Product.find({ category: { $in: [...categoryIds] }, status: "active", visibility: "public" }, "name slug price mrp media category rating reviewsCount").limit(200)
    : [];
  const productsByCollection = collectionIds.size
    ? await Product.find({ collections: { $in: [...collectionIds] }, status: "active", visibility: "public" }, "name slug price mrp media collections rating reviewsCount").limit(200)
    : [];

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const categoryMap = new Map(categories.map((c) => [String(c._id), c]));
  const collectionMap = new Map(collections.map((c) => [String(c._id), c]));
  const bannerMap = new Map(banners.map((b) => [String(b._id), b]));
  const faqMap = new Map(faqsById.map((f) => [String(f._id), f]));
  const reviewProductMap = new Map(reviewProducts.map((p) => [String(p._id), p]));

  return blocks
    .filter((b) => b.visibility !== "hidden")
    .map((block) => {
      const d = block.data || {};
      const resolved = { type: block.type, order: block.order, settings: block.settings, data: { ...d } };

      if (block.type === "productGrid") {
        if (d.mode === "manual") resolved.data.products = (d.productIds || []).map((id) => productMap.get(String(id))).filter(Boolean);
        else if (d.categoryId) resolved.data.products = productsByCategory.filter((p) => String(p.category) === String(d.categoryId)).slice(0, d.limit || 12);
        else if (d.collectionId) resolved.data.products = productsByCollection.filter((p) => (p.collections || []).some((c) => String(c) === String(d.collectionId))).slice(0, d.limit || 12);
      }
      if (block.type === "categoryGrid") resolved.data.categories = (d.categoryIds || []).map((id) => categoryMap.get(String(id))).filter(Boolean);
      if (block.type === "collectionGrid") resolved.data.collections = (d.collectionIds || []).map((id) => collectionMap.get(String(id))).filter(Boolean);
      if (block.type === "banner") resolved.data.banner = bannerMap.get(String(d.bannerId)) || null;
      if (block.type === "faq") {
        resolved.data.faqs = d.faqIds?.length
          ? d.faqIds.map((id) => faqMap.get(String(id))).filter(Boolean)
          : faqsByCategory.filter((f) => !d.category || f.category === d.category);
      }
      if (block.type === "reviewSummary") resolved.data.product = reviewProductMap.get(String(d.productId)) || null;
      if (block.type === "hero") {
        resolved.data.image = resolveMedia(d.image);
        resolved.data.mobileImage = resolveMedia(d.mobileImage);
      }
      if (block.type === "image" || block.type === "imageText") {
        resolved.data.image = resolveMedia(d.image);
      }

      return resolved;
    });
}

// GET /content/pages/:slug — public, PUBLISHED ONLY (rule #82 — never
// return a draft through the normal public API, no exceptions).
export async function getPublishedPage(slug) {
  const page = await Page.findOne({ slug, status: "published" });
  if (!page) fail("Page not found", "PAGE_NOT_FOUND");
  const [blocks, globalSeo] = await Promise.all([resolveBlocks(page.blocks), seoService.getSEOSettings()]);
  return { title: page.title, slug: page.slug, blocks, seo: seoService.resolveSEO(page.seo, globalSeo), publishedAt: page.publishedAt };
}

export async function getPublishedHomepage() {
  const page = await Page.findOne({ pageType: "homepage", status: "published" });
  if (!page) return { blocks: [], seo: {} }; // no published homepage yet — storefront falls back to its own default, never a 500
  const [blocks, globalSeo] = await Promise.all([resolveBlocks(page.blocks), seoService.getSEOSettings()]);
  return { blocks, seo: seoService.resolveSEO(page.seo, globalSeo) };
}

export async function getPublishedBlogPost(slug) {
  const post = await BlogPost.findOne({ slug, status: "published" }).populate("featuredImage").populate("author", "firstName lastName");
  if (!post) fail("Blog post not found", "BLOG_NOT_FOUND");
  const globalSeo = await seoService.getSEOSettings();
  return { ...post.toObject(), seo: seoService.resolveSEO(post.seo, globalSeo) };
}

export async function listPublishedBlogPosts({ category, tag, page = 1, limit = 10 } = {}) {
  const filter = { status: "published" };
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  const [posts, total] = await Promise.all([
    BlogPost.find(filter, "title slug excerpt featuredImage category tags publishedAt").sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("featuredImage"),
    BlogPost.countDocuments(filter),
  ]);
  return { posts, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export async function getPublicFAQs(category) {
  const filter = { status: "active" };
  if (category) filter.category = category;
  return FAQ.find(filter).sort({ category: 1, order: 1 });
}

export async function getPublicNavigation(name) {
  return navigationService.getMenu(name);
}

export async function getPublicFooter() {
  return footerService.getFooter();
}

export async function getPublicBanners(target, targetId) {
  return getActiveBanners({ target, targetId });
}

export { fail };
