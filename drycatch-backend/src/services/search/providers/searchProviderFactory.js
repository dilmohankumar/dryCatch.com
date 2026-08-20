import { mongoSearchProvider } from "./mongoSearchProvider.js";
import { opensearchProvider } from "./opensearchProvider.js";

const PROVIDERS = { mongo: mongoSearchProvider, opensearch: opensearchProvider };

// Single knob: SEARCH_PROVIDER env var, default "mongo" (the only provider
// with real, working logic in this environment). searchService never
// branches on provider name — it always talks to whatever this returns
// (rule #72/#129).
export function getSearchProvider(name = process.env.SEARCH_PROVIDER || "mongo") {
  const provider = PROVIDERS[name];
  if (!provider) throw Object.assign(new Error(`Unknown search provider: ${name}`), { statusCode: 500 });
  return provider;
}
