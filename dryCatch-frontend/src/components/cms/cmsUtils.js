// Shared helpers for CMS block components (Phase 15).
//
// IMPORTANT: unlike `banner`/`productGrid`/`categoryGrid`/etc., the public
// content API's resolveBlocks() (drycatch-backend/src/services/cms/
// contentApiService.js) does NOT resolve `hero.image`/`mobileImage`,
// `image.image`, `imageText.image`, or `testimonials.reviewIds` — those
// pass through exactly as stored on the Page document. Depending on what
// the admin editor saved, `image` may be a plain URL string, a populated
// MediaAsset-like object ({ url, altText, ... }), or a bare media id
// string that never resolves to anything renderable. Every block below
// must treat these fields defensively.

// Returns a usable <img> src from a hero/image/imageText/banner `image`
// field, whatever shape it happens to be in. Returns "" (never throws) if
// nothing usable is found — callers should skip rendering the <img> then.
export function resolveImageUrl(image) {
  if (!image) return "";
  if (typeof image === "string") {
    // A raw Mongo ObjectId string (24 hex chars) isn't a usable URL — it's
    // an unresolved media reference the backend never populated.
    if (/^[0-9a-fA-F]{24}$/.test(image)) return "";
    return image;
  }
  if (typeof image === "object") {
    return image.url || image.secureUrl || image.src || "";
  }
  return "";
}

export function resolveAltText(image, fallback = "") {
  if (image && typeof image === "object") return image.altText || image.alt || fallback;
  return fallback;
}
