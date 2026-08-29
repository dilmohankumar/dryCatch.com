import { useEffect } from "react";

// Phase 23 — the ONE place page metadata gets applied to the DOM (rule #7:
// "do not manually hardcode metadata throughout random components").
// Replaces the two ad-hoc document.title/meta-description snippets that
// previously existed only in home.jsx and CmsPage.jsx, and extends the
// same pattern to canonical/robots/Open Graph/JSON-LD, applied
// consistently to every page.
//
// Known, documented limitation (see docs/seo.md): this project is a pure
// client-side-rendered SPA (Vite, no SSR/SSG framework) — these tags are
// only present after React executes, not in the initial HTML response.
// Modern Googlebot renders JavaScript before evaluating a page's SEO
// signals, so this genuinely works for Google. It does NOT help crawlers/
// bots that don't execute JavaScript (some social-media link-preview
// bots, some smaller search engines) — the true fix is server-side
// rendering, which is a framework migration out of scope for this pass.
function upsertMetaTag(attr, value, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attr}="${value}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLinkTag(rel, href) {
  let tag = document.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  let script = document.getElementById(id);
  if (!data) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

// `jsonLd` may be a single object or an array of objects (e.g. Product +
// BreadcrumbList on the same page) — each gets its own <script> tag keyed
// by index so they don't clobber each other.
export function useSEO({ title, description, canonical, robots = "index,follow", ogImage, ogType = "website", jsonLd }) {
  useEffect(() => {
    if (title) document.title = title;
    upsertMetaTag("name", "description", description);
    upsertMetaTag("name", "robots", robots);
    upsertLinkTag("canonical", canonical ? `${window.location.origin}${canonical}` : undefined);

    upsertMetaTag("property", "og:title", title);
    upsertMetaTag("property", "og:description", description);
    upsertMetaTag("property", "og:type", ogType);
    upsertMetaTag("property", "og:url", canonical ? `${window.location.origin}${canonical}` : window.location.href);
    upsertMetaTag("property", "og:image", ogImage);
    upsertMetaTag("name", "twitter:card", ogImage ? "summary_large_image" : "summary");

    const jsonLdList = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
    jsonLdList.forEach((data, i) => upsertJsonLd(`seo-jsonld-${i}`, data));
    // Clear any leftover script tags from a previous page that had MORE
    // JSON-LD blocks than this one (e.g. navigating from a product page
    // with 2 blocks to one with 0).
    for (let i = jsonLdList.length; i < 5; i++) upsertJsonLd(`seo-jsonld-${i}`, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonical, robots, ogImage, ogType, JSON.stringify(jsonLd)]);
}
