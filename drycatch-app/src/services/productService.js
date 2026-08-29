import api from "./api";

// Adapts the backend's Product document shape into what the UI components
// expect. The backend has no guaranteed product photos in this dataset
// (media/slides are empty for the seeded demo catalog) — we surface the
// product's `emoji` as a placeholder tile instead of inventing image URLs.
export function mapProduct(raw) {
  if (!raw) return null;
  const media = raw.media?.length ? raw.media.map((m) => m.url) : raw.slides?.length ? raw.slides : [];
  return {
    id: raw._id,
    slug: raw.slug,
    name: raw.name,
    category: raw.category?.name || null,
    categorySlug: raw.category?.slug || null,
    description: raw.description || raw.shortDescription || "",
    emoji: raw.emoji || "🐟",
    images: media,
    price: raw.price,
    mrp: raw.mrp,
    discountPct: raw.discountPct || 0,
    weight: raw.weight,
    rating: raw.rating || 0,
    reviewsCount: raw.reviewsCount || 0,
    featured: Boolean(raw.featured),
    defaultVariantId: raw.defaultVariantId,
  };
}

function mapVariant(raw) {
  return {
    id: raw.id || raw._id,
    label: raw.weight?.label || raw.sku || "Standard",
    price: raw.price,
    mrp: raw.mrp,
    discountPct: raw.discountPct || 0,
    status: raw.status,
    isDefault: Boolean(raw.isDefault),
  };
}

export async function fetchProducts({ category, search, sort, page = 1, limit = 24 } = {}) {
  const { data } = await api.get("/products", {
    params: { category, search, sort, page, limit },
  });
  return {
    items: data.data.items.map(mapProduct),
    pagination: data.data.pagination,
  };
}

export async function fetchFeaturedProducts() {
  const { data } = await api.get("/products/featured");
  return data.products.map(mapProduct);
}

export async function fetchProductByIdOrSlug(idOrSlug) {
  const { data } = await api.get(`/products/${idOrSlug}`);
  return mapProduct(data.product);
}

export async function fetchProductVariants(productId) {
  const { data } = await api.get(`/products/${productId}/variants`);
  return data.variants.map(mapVariant);
}

export async function fetchCategories() {
  const { data } = await api.get("/categories");
  return data.categories.map((c) => ({ id: c._id, label: c.name, slug: c.slug }));
}
