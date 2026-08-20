import Product from "../../models/Product.js";
import Category from "../../models/Category.js";
import Collection from "../../models/Collection.js";
import Page from "../../models/Page.js";
import BlogPost from "../../models/BlogPost.js";
import { cached } from "../../utils/analyticsCache.js";

// Phase 23 — scalable sitemap architecture (rule #17/#18). A sitemap
// INDEX referencing one sitemap per content type, not one giant file —
// each per-type sitemap is itself chunked at 50,000 URLs (the sitemap
// protocol's hard limit) via `chunk`, so this keeps working correctly if
// the catalog grows from dozens to hundreds of thousands of products
// without any code change, even though this project's current catalog is
// nowhere near that scale.
const SITEMAP_URL_LIMIT = 50_000;
const CACHE_TTL_MS = 5 * 60_000; // sitemaps don't need to be byte-fresh; a short cache avoids rebuilding on every crawler hit

function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:5173").replace(/\/$/, "");
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function urlEntry(path, { lastmod, changefreq, priority } = {}) {
  const parts = [`<loc>${siteUrl()}${escapeXml(path)}</loc>`];
  if (lastmod) parts.push(`<lastmod>${new Date(lastmod).toISOString()}</lastmod>`);
  if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) parts.push(`<priority>${priority}</priority>`);
  return `<url>${parts.join("")}</url>`;
}

function escapeXml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrapUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
}

// Only public, indexable, canonical entities (rule #19) — never draft
// products, archived categories, or unpublished CMS content.
async function getProductEntries() {
  const products = await Product.find({ status: "active", visibility: "public" }, "slug updatedAt").lean();
  return products.map((p) => urlEntry(`/products/${p.slug}`, { lastmod: p.updatedAt, changefreq: "weekly", priority: 0.8 }));
}
async function getCategoryEntries() {
  const categories = await Category.find({ status: "active" }, "slug updatedAt").lean();
  return categories.map((c) => urlEntry(`/category/${c.slug}`, { lastmod: c.updatedAt, changefreq: "weekly", priority: 0.7 }));
}
async function getCollectionEntries() {
  const collections = await Collection.find({ status: "active" }, "slug updatedAt").lean();
  return collections.map((c) => urlEntry(`/collections/${c.slug}`, { lastmod: c.updatedAt, changefreq: "weekly", priority: 0.6 }));
}
async function getCmsPageEntries() {
  const pages = await Page.find({ status: "published", pageType: { $ne: "homepage" } }, "slug updatedAt").lean();
  return pages.map((p) => urlEntry(`/pages/${p.slug}`, { lastmod: p.updatedAt, changefreq: "monthly", priority: 0.5 }));
}
async function getBlogEntries() {
  const posts = await BlogPost.find({ status: "published" }, "slug updatedAt").lean();
  return posts.map((p) => urlEntry(`/blog/${p.slug}`, { lastmod: p.updatedAt, changefreq: "monthly", priority: 0.5 }));
}

const SECTION_BUILDERS = {
  products: getProductEntries,
  categories: getCategoryEntries,
  collections: getCollectionEntries,
  pages: getCmsPageEntries,
  blog: getBlogEntries,
};

// GET /sitemaps/:section-:index.xml — one chunk of one content type.
export async function getSitemapChunk(section, chunkIndex) {
  const builder = SECTION_BUILDERS[section];
  if (!builder) return null;
  return cached(`sitemap:${section}`, CACHE_TTL_MS, async () => {
    const entries = await builder();
    return chunk(entries, SITEMAP_URL_LIMIT);
  }).then((chunks) => (chunks[chunkIndex] ? wrapUrlset(chunks[chunkIndex]) : null));
}

// GET /sitemap.xml — the index referencing every section's chunk(s).
export async function getSitemapIndex() {
  return cached("sitemap:index", CACHE_TTL_MS, async () => {
    const refs = [];
    for (const [section, builder] of Object.entries(SECTION_BUILDERS)) {
      const entries = await builder();
      const chunks = chunk(entries, SITEMAP_URL_LIMIT);
      chunks.forEach((_, i) => refs.push(`<sitemap><loc>${siteUrl()}/sitemaps/${section}-${i}.xml</loc></sitemap>`));
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${refs.join("\n")}\n</sitemapindex>`;
  });
}

// IMPORTANT deployment note (see docs/seo.md): robots.txt and sitemap.xml
// MUST be reachable at the STOREFRONT's own origin (SITE_URL) for a
// crawler to trust them — a robots.txt served from the API's origin
// (a different host/port) has no effect on crawling the storefront.
// These paths listed here (`/account`, `/cart`, etc.) are frontend SPA
// routes, not backend API routes, for exactly that reason. Until a
// reverse proxy unifies both origins (Phase 21's documented gap — no
// hosting target chosen yet), the frontend's own static host must either
// proxy `/robots.txt`/`/sitemap.xml`/`/sitemaps/*` to this backend, or
// serve a periodically-regenerated static copy.
export function getRobotsTxt() {
  const lines = [
    "User-agent: *",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /admin",
    `Sitemap: ${siteUrl()}/sitemap.xml`,
  ];
  return lines.join("\n");
}
