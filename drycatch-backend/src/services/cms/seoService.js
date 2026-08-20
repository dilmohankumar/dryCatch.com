import SEOSettings from "../../models/SEOSettings.js";

export async function getSEOSettings() {
  return (await SEOSettings.findOne()) || {};
}

// Requires cms.seo.update specifically (checked at the route layer, not
// here) — separate from ordinary content-editing permissions (rule #58/
// #126: "prevent accidental site-wide noindex from normal content
// editing").
export async function updateSEOSettings(userId, data) {
  return SEOSettings.findOneAndUpdate({}, { $set: { ...data, updatedBy: userId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

// Page-specific SEO always wins over the global default (rule #56) — this
// is the one place that merge happens, so contentApiService and any future
// consumer never re-implement the fallback logic differently.
export function resolveSEO(pageSeo, globalDefaults) {
  return {
    title: pageSeo?.title || globalDefaults?.defaultTitle,
    description: pageSeo?.description || globalDefaults?.defaultDescription,
    canonicalUrl: pageSeo?.canonicalUrl,
    ogTitle: pageSeo?.ogTitle || pageSeo?.title || globalDefaults?.defaultTitle,
    ogDescription: pageSeo?.ogDescription || pageSeo?.description || globalDefaults?.defaultDescription,
    ogImage: pageSeo?.ogImage || globalDefaults?.defaultOgImage,
    robots: pageSeo?.robots || globalDefaults?.robotsGlobal || "index_follow",
  };
}
