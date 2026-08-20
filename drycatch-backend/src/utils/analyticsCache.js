// No Redis exists in this project (confirmed by audit before this phase) —
// this is an honest in-process TTL cache, not a distributed one. It caches
// per-process, so it doesn't help a multi-instance deployment, but it does
// exactly what rule #101 asks for at the current single-process scale:
// short TTL for near-real-time data, longer TTL for historical/expensive
// aggregation queries. Swapping in Redis later means replacing this
// module's internals, not any call site.
const store = new Map();

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function cached(key, ttlMs, compute) {
  const existing = getCached(key);
  if (existing !== undefined) return existing;
  const value = await compute();
  setCached(key, value, ttlMs);
  return value;
}

// Scope-prefixed invalidation (rule #102 — never random) — called whenever
// an aggregate write happens for a given day, so a dashboard never serves
// stale data past the next write.
export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
