// ── Product normalization ────────────────────────────────────────────────
// The backend Product schema (see drycatch-backend/src/models/Product.js)
// differs slightly from the shape the UI components were originally built
// against (mock data in pages/productGrid.jsx). This adapter bridges the
// two so ProductGrid / ProductCarousel / ProductDetail / CategoryPage keep
// working unmodified against real API data:
//   - Mongo's `_id` is aliased to `id` (components read `product.id`)
//   - `reviewsCount` -> `reviews`, `featured` -> `bestseller`
//   - `category` (an ObjectId ref, or populated {name}) is resolved to a
//     plain category name string when a categoryNameById map is supplied
//   - `variants` always has at least one entry, built from price/mrp/weight
//     when the product has none
//   - `image` falls back to the first `slides` URL, then a local placeholder
import bombayDuck from "../assets/bombay-duck.jpg";

export const PLACEHOLDER_IMAGE = bombayDuck;

export function normalizeProduct(raw, categoryNameById = {}) {
  if (!raw) return raw;
  const id = raw._id || raw.id;

  let categoryName = raw.category;
  if (raw.category && typeof raw.category === "object") {
    categoryName = raw.category.name || "";
  } else if (raw.category && categoryNameById[raw.category]) {
    categoryName = categoryNameById[raw.category];
  }

  const variants =
    Array.isArray(raw.variants) && raw.variants.length > 0
      ? raw.variants
      : [{ label: raw.weight || "", price: raw.price, mrp: raw.mrp ?? raw.price }];

  const primaryMedia = Array.isArray(raw.media) && raw.media.length > 0
    ? [...raw.media].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
    : null;

  return {
    ...raw,
    id,
    category: categoryName || "",
    image: raw.image || primaryMedia?.url || (Array.isArray(raw.slides) && raw.slides[0]) || PLACEHOLDER_IMAGE,
    imageAlt: primaryMedia?.alt || raw.name || "",
    slides: Array.isArray(raw.slides) ? raw.slides : [],
    reviews: raw.reviewsCount ?? raw.reviews ?? 0,
    rating: raw.rating || 0,
    bestseller: raw.featured ?? raw.bestseller ?? false,
    variants,
  };
}

export function normalizeProducts(rawList = [], categoryNameById = {}) {
  return rawList.map((p) => normalizeProduct(p, categoryNameById));
}

// Builds a { [categoryId]: categoryName } lookup from categoriesAPI.getAll().
export function buildCategoryNameMap(categories = []) {
  const map = {};
  for (const c of categories) {
    if (c && c._id) map[c._id] = c.name;
  }
  return map;
}
