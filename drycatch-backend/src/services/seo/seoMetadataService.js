import SEOSettings from "../../models/SEOSettings.js";

// Phase 23 — the ONE place page metadata gets resolved (rule #7: "do not
// manually hardcode metadata throughout random components"). Reuses
// Phase 15's SEOSettings singleton and its store-wide defaults rather
// than inventing a second config surface. Custom per-entity `seo.title`/
// `seo.description` always wins; an automatic, still-unique fallback is
// generated when the admin hasn't set one (rule #51 — "do not force
// manual SEO configuration for every product").
export const STORE_NAME = process.env.STORE_NAME || "DryCatch";

const TITLE_MAX = 60; // conventional SERP truncation point, not a hard rule (rule #52's "not absolute ranking rules")
const DESCRIPTION_MAX = 160;

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

async function getGlobalDefaults() {
  return (await SEOSettings.findOne()) || {};
}

// Product title: "Product Name | Category | Store Name" (rule #8) — falls
// back gracefully if category is missing (draft product, uncategorized).
export async function resolveProductSEO(product) {
  const defaults = await getGlobalDefaults();
  const categoryName = product.category?.name;
  const title = product.seo?.title || truncate([product.name, categoryName, STORE_NAME].filter(Boolean).join(" | "), TITLE_MAX);
  const description =
    product.seo?.description ||
    truncate(product.shortDescription || product.description || `Buy ${product.name} online at ${STORE_NAME}.`, DESCRIPTION_MAX);
  return {
    title,
    description,
    keywords: product.seo?.keywords || [],
    canonical: `/products/${product.slug}`,
    // Genuinely thin/unavailable content should not compete for index slots
    // (rule #20's "do not create thin product pages") — an archived/draft
    // product is real content just not meant to be found publicly yet.
    robots: product.status === "active" && product.visibility === "public" ? "index,follow" : "noindex,follow",
    ogImage: product.media?.[0]?.url || defaults.defaultOgImage,
    ogType: "product",
  };
}

export async function resolveCategorySEO(category) {
  const defaults = await getGlobalDefaults();
  const title = category.seo?.title || truncate(`Buy ${category.name} Online | ${STORE_NAME}`, TITLE_MAX);
  const description =
    category.seo?.description ||
    truncate(category.description || `Shop our ${category.name} collection at ${STORE_NAME}.`, DESCRIPTION_MAX);
  return {
    title,
    description,
    canonical: `/category/${category.slug}`,
    robots: category.status === "active" ? "index,follow" : "noindex,follow",
    ogImage: category.image || defaults.defaultOgImage,
    ogType: "website",
  };
}

export async function resolveCollectionSEO(collection) {
  const defaults = await getGlobalDefaults();
  const title = collection.seo?.title || truncate(`${collection.name} | ${STORE_NAME}`, TITLE_MAX);
  const description = collection.seo?.description || truncate(collection.description || `Explore ${collection.name} at ${STORE_NAME}.`, DESCRIPTION_MAX);
  return {
    title,
    description,
    canonical: `/collections/${collection.slug}`,
    // Rule #23 — "not every automatically generated collection should be
    // indexed." An explicit `seo.noindex` flag on Collection (if the admin
    // sets it) wins; otherwise an active collection defaults to indexable.
    robots: collection.seo?.noindex || collection.status !== "active" ? "noindex,follow" : "index,follow",
    ogImage: collection.image || defaults.defaultOgImage,
    ogType: "website",
  };
}

// Pagination/filter/sort variants of a listing page (rule #29-31) — the
// FIRST page is canonical and indexable; every other page/filter/sort
// combination canonicalizes back to page 1 of the same listing and is
// itself noindexed, so crawl budget isn't spent on
// `?price=10-20&sort=price_desc&page=7` as a competing "page."
export function resolveListingPageSEO(baseCanonical, { page = 1, hasFilters = false, hasSort = false } = {}) {
  const isFirstPageNoFilters = page <= 1 && !hasFilters && !hasSort;
  return {
    canonical: baseCanonical, // ALWAYS points at the clean base URL, regardless of query params
    robots: isFirstPageNoFilters ? "index,follow" : "noindex,follow",
  };
}
