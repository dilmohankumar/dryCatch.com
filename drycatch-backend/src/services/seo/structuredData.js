import { STORE_NAME } from "./seoMetadataService.js";

// Phase 23 — centralized structured-data generation (rule #44). Every
// function here returns a plain object matching schema.org's JSON-LD
// shape, built ONLY from fields the page actually renders (rule #21/#45 —
// "do not fabricate ratings or reviews," "must not claim something the
// page does not provide"). Pure functions, no I/O, so they're fully unit
// testable without a database.
function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: STORE_NAME,
    url: siteUrl(),
    logo: `${siteUrl()}/favicon.svg`,
  };
}

export function buildWebsiteJsonLd() {
  // No real site-search endpoint exposes a query-string GET contract
  // suitable for SearchAction yet (Phase 13's search is a POST-free GET
  // with its own param shape) — omitted rather than fabricated (rule #47's
  // explicit "only when correctly implemented").
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: STORE_NAME,
    url: siteUrl(),
  };
}

export function buildBreadcrumbJsonLd(items) {
  // items: [{ name, path }] in order from Home to the current page.
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl()}${item.path}`,
    })),
  };
}

// Product structured data (rule #21) — `aggregateRating`/`review` are only
// included when the product genuinely has published reviews (Phase 12's
// `reviewsCount`/`averageRating`, already computed from real published
// reviews only — never fabricated here or upstream).
export function buildProductJsonLd(product, { variant } = {}) {
  const price = variant?.price ?? product.price;
  const availability = resolveAvailability(variant);

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.description || undefined,
    image: (product.media || []).map((m) => m.url).filter(Boolean),
    sku: variant?.sku || undefined,
    brand: { "@type": "Brand", name: STORE_NAME },
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}/products/${product.slug}`,
      priceCurrency: "INR",
      price: price != null ? String(price) : undefined,
      availability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (product.reviewsCount > 0 && product.rating > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(product.rating),
      reviewCount: String(product.reviewsCount),
    };
  }

  return data;
}

function resolveAvailability(variant) {
  if (!variant) return "https://schema.org/InStock"; // no variant context (e.g. listing card) — availability is variant-level, resolved at the product-detail level where a variant IS known
  if (variant.availableQuantity > 0 || variant.available) return "https://schema.org/InStock";
  return "https://schema.org/OutOfStock";
}

// Article structured data for CMS blog posts (rule #41).
export function buildArticleJsonLd(post) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.featuredImage?.url ? [post.featuredImage.url] : undefined,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
    author: post.author ? { "@type": "Person", name: `${post.author.firstName || ""} ${post.author.lastName || ""}`.trim() } : undefined,
  };
}

// FAQPage structured data — only when the page has genuinely published
// FAQ content (Phase 15's FAQ block), never generated speculatively.
export function buildFaqJsonLd(faqs) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
