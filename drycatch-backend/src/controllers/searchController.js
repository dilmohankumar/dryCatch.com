import * as searchService from "../services/search/searchService.js";
import * as searchAnalyticsService from "../services/search/searchAnalyticsService.js";

function parseFilters(query) {
  const filters = {};
  if (query.categoryId) filters.categoryId = query.categoryId;
  if (query.minPrice) filters.minPrice = query.minPrice;
  if (query.maxPrice) filters.maxPrice = query.maxPrice;
  if (query.rating) filters.rating = query.rating;
  if (query.availability) filters.availability = query.availability;
  return filters;
}

// GET /search?q=&categoryId=&minPrice=&maxPrice=&rating=&availability=&sort=&page=&limit=
export async function getSearch(req, res) {
  const result = await searchService.search({
    q: req.query.q || "",
    filters: parseFilters(req.query),
    sort: req.query.sort || "relevance",
    page: req.query.page,
    limit: req.query.limit,
    sessionId: req.cookies?.guest_cart_id || req.sessionID,
    customerId: req.user?._id,
  });
  res.json(result);
}

// GET /search/autocomplete?q=
export async function getAutocomplete(req, res) {
  const result = await searchService.autocomplete(req.query.q || "", { limit: req.query.limit });
  res.json(result);
}

// GET /search/suggestions?q=
export async function getSuggestions(req, res) {
  const result = await searchService.suggest(req.query.q || "", { limit: req.query.limit });
  res.json({ suggestions: result });
}

// POST /search/events/click — { query, productId, position }
export async function postClickEvent(req, res) {
  const { query, productId, position } = req.body;
  await searchAnalyticsService.trackResultClicked({
    query, productId, position,
    sessionId: req.cookies?.guest_cart_id || req.sessionID,
    customerId: req.user?._id,
  });
  res.status(201).json({ ok: true });
}
