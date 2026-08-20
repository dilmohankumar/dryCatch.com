import SearchSynonym from "../../models/SearchSynonym.js";

let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60 * 1000; // short TTL, not correctness-critical — rule #93's "cache must invalidate after catalog changes" concern doesn't apply to synonyms the same way, but a stale synonym list for up to a minute is an acceptable tradeoff over a query on every search

async function loadActiveSynonyms() {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const rows = await SearchSynonym.find({ status: "active" }).lean();
  cache = new Map(rows.map((r) => [r.term, r.synonyms]));
  cacheAt = Date.now();
  return cache;
}

export function invalidateSynonymCache() {
  cache = null;
}

// Expands a raw query into itself plus every configured synonym term
// (rule #13/#14) — e.g. "kaju" -> "kaju cashew cashew nuts". Mongo's
// $text search then matches against the union, which is a simpler
// (if less precise) approach than a real search engine's synonym token
// filter applied at the analyzer level, but requires no reindex when an
// admin edits a synonym.
export async function expandQuery(query) {
  const synonyms = await loadActiveSynonyms();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const syn of synonyms.get(term) || []) expanded.add(syn);
  }
  // Reverse lookup too — "cashew" should also surface a product only
  // tagged/named with "kaju" if an admin configured that direction.
  for (const [term, synonymList] of synonyms.entries()) {
    if (synonymList.some((s) => terms.includes(s))) expanded.add(term);
  }
  return Array.from(expanded).join(" ");
}

export async function listSynonyms() {
  return SearchSynonym.find().sort({ term: 1 });
}

export async function createSynonym(userId, { term, synonyms, status }) {
  const doc = await SearchSynonym.create({ term, synonyms, status, createdBy: userId });
  invalidateSynonymCache();
  return doc;
}

export async function updateSynonym(id, { term, synonyms, status }) {
  const doc = await SearchSynonym.findByIdAndUpdate(id, { term, synonyms, status }, { new: true });
  invalidateSynonymCache();
  return doc;
}

export async function deleteSynonym(id) {
  await SearchSynonym.findByIdAndDelete(id);
  invalidateSynonymCache();
}
