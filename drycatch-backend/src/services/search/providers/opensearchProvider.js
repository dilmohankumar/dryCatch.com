// No OpenSearch/Elasticsearch cluster exists in this project — honest
// stub, identical "fails loudly, never fakes success" rule as Phase 8's
// stripeProvider and Phase 10's shiprocketAdapter. The mapping/analyzer
// design this would need (rule #134-137: text vs keyword fields, edge
// n-grams, synonym filters) is documented in docs/search.md rather than
// implemented against a cluster that doesn't exist.
function notConfigured() {
  throw Object.assign(new Error("OpenSearch is not configured for this deployment"), {
    statusCode: 503,
    code: "SEARCH_PROVIDER_NOT_CONFIGURED",
  });
}

export const opensearchProvider = {
  name: "opensearch",
  async search() { notConfigured(); },
  async facets() { notConfigured(); },
  async autocomplete() { notConfigured(); },
  async index() { notConfigured(); },
  async update() { notConfigured(); },
  async remove() { notConfigured(); },
  async bulkIndex() { notConfigured(); },
  async reindexAll() { notConfigured(); },
  async healthCheck() { return { healthy: false, provider: "opensearch", reason: "not configured" }; },
};
