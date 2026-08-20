import SearchEvent from "../../models/SearchEvent.js";

function normalize(query) {
  return String(query || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function trackSearchPerformed({ query, resultCount, filters, sort, sessionId, customerId }) {
  await SearchEvent.create({
    type: resultCount === 0 ? "no_results" : "performed",
    query, normalizedQuery: normalize(query), resultCount, filters, sort, sessionId, customer: customerId,
  });
}

export async function trackResultClicked({ query, productId, position, sessionId, customerId }) {
  await SearchEvent.create({
    type: "clicked", query, normalizedQuery: normalize(query), product: productId, position, sessionId, customer: customerId,
  });
}

// ---- Admin dashboard reads (rule #54/#113/#114) ----

export async function getTopQueries({ days = 30, limit = 20 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  return SearchEvent.aggregate([
    { $match: { type: { $in: ["performed", "no_results"] }, createdAt: { $gte: since }, normalizedQuery: { $ne: "" } } },
    { $group: { _id: "$normalizedQuery", count: { $sum: 1 }, avgResults: { $avg: "$resultCount" } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

export async function getZeroResultQueries({ days = 30, limit = 20 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  return SearchEvent.aggregate([
    { $match: { type: "no_results", createdAt: { $gte: since }, normalizedQuery: { $ne: "" } } },
    { $group: { _id: "$normalizedQuery", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
}

// CTR = clicked / performed for the same normalized query (rule #54).
export async function getClickThroughRate({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const [performed, clicked] = await Promise.all([
    SearchEvent.countDocuments({ type: { $in: ["performed", "no_results"] }, createdAt: { $gte: since } }),
    SearchEvent.countDocuments({ type: "clicked", createdAt: { $gte: since } }),
  ]);
  return { performed, clicked, ctr: performed ? Math.round((clicked / performed) * 1000) / 10 : 0 };
}

export async function getZeroResultRate({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const [total, zero] = await Promise.all([
    SearchEvent.countDocuments({ type: { $in: ["performed", "no_results"] }, createdAt: { $gte: since } }),
    SearchEvent.countDocuments({ type: "no_results", createdAt: { $gte: since } }),
  ]);
  return { total, zero, rate: total ? Math.round((zero / total) * 1000) / 10 : 0 };
}
