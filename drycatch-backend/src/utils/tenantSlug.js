// Phase 25 (rule #7) — slugs double as the platform subdomain
// (`{slug}.PLATFORM_DOMAIN`), so validation has to protect real platform
// routes, not just look "clean". This list mirrors every top-level path
// segment this app's own routing actually uses (auth/api/admin/etc.) plus
// generic SaaS reserved words a customer would reasonably try.
export const RESERVED_SLUGS = new Set([
  "admin", "api", "www", "app", "platform", "auth", "login", "signup",
  "static", "assets", "cdn", "mail", "email", "ftp", "billing", "support",
  "help", "docs", "status", "blog", "dashboard", "account", "settings",
  "checkout", "cart", "webhooks", "health", "metrics", "internal", "root",
]);

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

export function validateTenantSlug(slug) {
  if (!slug || typeof slug !== "string") return "Slug is required";
  const normalized = slug.toLowerCase().trim();
  if (normalized.length < 3) return "Slug must be at least 3 characters";
  if (normalized.length > 63) return "Slug must be at most 63 characters";
  if (!SLUG_PATTERN.test(normalized)) return "Slug may only contain lowercase letters, numbers, and hyphens (not at the start/end)";
  if (RESERVED_SLUGS.has(normalized)) return "This slug is reserved and cannot be used";
  return null;
}
