// Contract-by-convention (same pattern as Phase 8's payment providers and
// Phase 10's carrier adapters) — searchService.js only ever calls these
// method names on whatever searchProviderFactory.getProvider() returns.
// This is what lets a real OpenSearch/Elasticsearch provider replace
// mongoSearchProvider.js later without touching searchService, ranking,
// synonyms, or merchandising logic (rule #72/#129).
//
// search({ text, filters, sort, page, limit }) -> { hits: [doc], total }
// autocomplete({ prefix, limit }) -> { products: [doc], categories: [str], searches: [str] }
// suggest({ prefix, limit }) -> [str]  — plain term suggestions
// index(doc) -> void
// update(productId, partialDoc) -> void
// remove(productId) -> void
// bulkIndex(docs) -> void
// reindexAll() -> { count }
// healthCheck() -> { healthy: boolean, provider: string }
export const SEARCH_PROVIDER_METHODS = [
  "search", "autocomplete", "suggest", "index", "update", "remove", "bulkIndex", "reindexAll", "healthCheck",
];
