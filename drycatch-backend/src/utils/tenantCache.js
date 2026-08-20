// Phase 25 — an in-process cache for the hostname → tenant lookup that
// runs on EVERY request (tenantContext.js). Without this, every request
// would hit Mongo twice (TenantDomain then Tenant) just to find out which
// store it's for. Short TTL (not indefinite) so a newly-suspended tenant
// takes effect within seconds, not until the next deploy — and explicitly
// invalidated by tenantService.js whenever a tenant's own status/domains
// change, so the common case (an admin suspends their own store) is instant.
const TTL_MS = 30_000;
const store = new Map();

export const tenantCache = {
  get(hostname) {
    const entry = store.get(hostname);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      store.delete(hostname);
      return undefined;
    }
    return entry.value;
  },
  set(hostname, value) {
    store.set(hostname, { value, expiresAt: Date.now() + TTL_MS });
  },
  invalidateAll() {
    store.clear();
  },
};
