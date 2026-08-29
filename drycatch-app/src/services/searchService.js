import api from "./api";

export async function search(q, { sort = "relevance", page = 1, limit = 20 } = {}) {
  const { data } = await api.get("/search", { params: { q, sort, page, limit } });
  return data; // { query, products: [{productId,name,slug,category,price,rating,reviewCount,...}], total, page, totalPages }
}

export async function autocomplete(q) {
  const { data } = await api.get("/search/autocomplete", { params: { q } });
  return data;
}

export async function trackResultClick({ query, productId, position }) {
  await api.post("/search/events/click", { query, productId, position }).catch(() => {});
}
