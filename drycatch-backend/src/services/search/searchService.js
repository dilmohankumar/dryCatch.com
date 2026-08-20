import ProductSearchIndex from "../../models/ProductSearchIndex.js";
import { getSearchProvider } from "./providers/searchProviderFactory.js";
import { expandQuery } from "./synonymService.js";
import { getRulesForQuery, applyMerchandising, checkRedirect } from "./searchRuleService.js";
import { rankHits } from "./rankingService.js";
import { trackSearchPerformed } from "./searchAnalyticsService.js";
import { closestMatch } from "../../utils/levenshtein.js";

const MAX_LIMIT = 50;

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

function validatePagination(page, limit) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 24)); // rule #79 — never an unbounded pageSize
  if (p > 500) fail("Page too deep — refine your search instead", "DEEP_PAGINATION_LIMIT", 400); // rule #81
  return { page: p, limit: l };
}

// Compact projection for result cards (rule #18/#88/#89) — never the full
// search-index document, and never N+1 product fetches per result.
function toResultDTO(hit) {
  return {
    productId: hit.product,
    name: hit.name,
    slug: hit.slug,
    category: hit.category,
    price: hit.price,
    minPrice: hit.minPrice,
    maxPrice: hit.maxPrice,
    rating: hit.rating,
    reviewCount: hit.reviewCount,
    inventoryStatus: hit.inventoryStatus,
    featured: hit.featured,
  };
}

// GET /search — the main orchestrator (rule #76): buildQuery -> provider
// search -> merchandising -> ranking -> facets -> analytics tracking.
export async function search({ q = "", filters = {}, sort = "relevance", page, limit, sessionId, customerId }) {
  const { page: p, limit: l } = validatePagination(page, limit);
  const provider = getSearchProvider();

  // Redirect check happens before anything else (rule #45) — a
  // merchandising redirect short-circuits the whole search.
  if (q) {
    const redirectUrl = await checkRedirect(q);
    if (redirectUrl) return { redirect: redirectUrl };
  }

  const expandedText = q ? await expandQuery(q) : "";
  const { hits, total } = await provider.search({ text: expandedText, filters, sort, page: p, limit: l });

  let results = hits;
  if (q) {
    const rules = await getRulesForQuery(q);
    results = rankHits(hits, { hasTextQuery: true });
    if (rules.length) results = await applyMerchandising(results, rules);
  } else if (sort === "relevance") {
    results = rankHits(hits, { hasTextQuery: false });
  }

  const facets = await provider.facets({ text: expandedText, filters });

  await trackSearchPerformed({ query: q, resultCount: total, filters, sort, sessionId, customerId }).catch(() => {});

  const response = {
    query: q,
    products: results.map(toResultDTO),
    total, page: p, pageSize: l, totalPages: Math.ceil(total / l),
    facets, sort, appliedFilters: filters,
  };

  // Zero-result handling (rule #46-48) — never a blank page.
  if (total === 0 && q) {
    response.didYouMean = await suggestSpellCorrection(q);
    response.popularProducts = await getPopularFallback();
    response.suggestedSearches = await getPopularQueries();
  }

  return response;
}

async function suggestSpellCorrection(query) {
  const knownTerms = await ProductSearchIndex.distinct("name");
  const words = knownTerms.flatMap((n) => n.toLowerCase().split(/\s+/));
  const candidate = closestMatch(query.toLowerCase(), [...new Set(words)], 2);
  return candidate && candidate !== query.toLowerCase() ? candidate : null;
}

async function getPopularFallback(limit = 8) {
  return ProductSearchIndex.find({ isActive: true, isPublished: true })
    .sort({ popularity: -1, rating: -1 }).limit(limit).lean().then((hits) => hits.map(toResultDTO));
}

async function getPopularQueries(limit = 5) {
  const { getTopQueries } = await import("./searchAnalyticsService.js");
  const top = await getTopQueries({ limit });
  return top.map((t) => t._id);
}

// GET /search/autocomplete — a separate, cheap query path (rule #16),
// grouped into products/categories/searches (rule #17).
export async function autocomplete(prefix, { limit = 6 } = {}) {
  if (!prefix || prefix.length < 2) return { products: [], categories: [], searches: [] }; // rule #23 — min query length

  const provider = getSearchProvider();
  const { products, categories } = await provider.autocomplete({ prefix, limit });
  const { getTopQueries } = await import("./searchAnalyticsService.js");
  const topQueries = await getTopQueries({ limit: 20 });
  const searches = topQueries
    .map((t) => t._id)
    .filter((query) => query?.startsWith(prefix.toLowerCase()))
    .slice(0, 5);

  return {
    products: products.map((p) => ({ productId: p._id, name: p.name, slug: p.slug, price: p.price ?? p.minPrice, category: p.category, rating: p.rating })),
    categories,
    searches,
  };
}

export async function suggest(prefix, { limit = 8 } = {}) {
  const result = await autocomplete(prefix, { limit });
  return [...result.searches, ...result.categories].slice(0, limit);
}

export { fail };
