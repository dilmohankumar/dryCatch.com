import Tenant from "../models/Tenant.js";
import TenantDomain from "../models/TenantDomain.js";
import { setTenantId } from "./requestContext.js";
import { tenantCache } from "../utils/tenantCache.js";

// Phase 25 (rule #8/#9) — the single place tenant identity is decided.
// Every other controller/service reads `req.tenant`, never re-derives it
// from a header or body field a client could forge (rule #10/#72). This
// mirrors requestContext.js's own "resolve once, read everywhere" shape.
//
// Resolution order: custom domain match first (a tenant that configured
// mystore.com should be reached by mystore.com, not just its subdomain),
// then the platform subdomain (`{slug}.PLATFORM_DOMAIN`).
const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || "drycatch.test";

function extractSlugFromHost(hostname) {
  const suffix = `.${PLATFORM_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  return slug && !slug.includes(".") ? slug : null;
}

async function resolveTenantByHost(hostname) {
  const cached = tenantCache.get(hostname);
  if (cached !== undefined) return cached;

  let tenant = null;
  const domain = await TenantDomain.findOne({ domain: hostname, status: { $in: ["verified", "active"] } });
  if (domain) {
    tenant = await Tenant.findById(domain.tenant);
  } else {
    const slug = extractSlugFromHost(hostname);
    if (slug) tenant = await Tenant.findOne({ slug });
  }

  tenantCache.set(hostname, tenant);
  return tenant;
}

// Optional resolution — attaches `req.tenant` when the host maps to a
// known tenant, but never rejects the request. Used for platform-level
// routes (auth, platform admin) that need to know "was this reached via
// a tenant's domain?" without requiring one.
export async function resolveTenantOptional(req, res, next) {
  try {
    const hostname = (req.hostname || "").toLowerCase();
    const tenant = hostname ? await resolveTenantByHost(hostname) : null;
    req.tenant = tenant || null;
    if (tenant) setTenantId(String(tenant._id));
    next();
  } catch (err) {
    next(err);
  }
}

// Required resolution — every storefront/tenant-admin route needs a real,
// non-suspended tenant or the request is rejected outright (rule #10:
// "tenant identity must not depend only on a client-provided tenantId" —
// there IS no client-provided tenantId path here at all).
export async function requireTenant(req, res, next) {
  try {
    const hostname = (req.hostname || "").toLowerCase();
    const tenant = hostname ? await resolveTenantByHost(hostname) : null;

    if (!tenant) {
      return res.status(404).json({ message: "No store found for this domain", code: "TENANT_NOT_FOUND" });
    }
    if (tenant.status === "suspended") {
      return res.status(403).json({ message: "This store is temporarily suspended", code: "TENANT_SUSPENDED" });
    }
    if (["cancelled", "deleted", "deletion_requested"].includes(tenant.status)) {
      return res.status(410).json({ message: "This store is no longer available", code: "TENANT_UNAVAILABLE" });
    }

    req.tenant = tenant;
    setTenantId(String(tenant._id));
    next();
  } catch (err) {
    next(err);
  }
}
