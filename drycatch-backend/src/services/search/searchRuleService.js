import SearchRule from "../../models/SearchRule.js";
import ProductSearchIndex from "../../models/ProductSearchIndex.js";

function activeNow(rule) {
  const now = new Date();
  if (rule.status !== "active") return false;
  if (rule.startAt && now < rule.startAt) return false;
  if (rule.endAt && now > rule.endAt) return false;
  return true;
}

// Merchandising (rule #43-45) — pin/boost/bury specific products for a
// specific query, or redirect the query entirely. Matched against the
// RAW normalized query (not the synonym-expanded one), so a rule for
// "gift" doesn't also fire for every product that happens to expand into
// "gift" via an unrelated synonym.
export async function getRulesForQuery(query) {
  const normalized = query.toLowerCase().trim();
  const rules = await SearchRule.find({ query: normalized }).populate("product", "name slug");
  return rules.filter(activeNow);
}

export async function checkRedirect(query) {
  const rules = await getRulesForQuery(query);
  const redirect = rules.find((r) => r.action === "redirect");
  return redirect?.redirectUrl || null;
}

// Applies pin (force to the very top, in priority order) / boost (score
// multiplier) / bury (score penalty) to an already-ranked hit list —
// merchandising never destroys organic relevance for the whole query
// (rule #44), it only reorders around it.
//
// A pinned product is NOT required to have organically matched the text
// search — that's the entire point of pinning (rule #44's own example is a
// cross-sell/promotional placement, not "boost a result that's already
// there"). So a pin whose target isn't in `hits` is fetched directly from
// the search index and injected, rather than being silently dropped.
export async function applyMerchandising(hits, rules) {
  const pins = rules.filter((r) => r.action === "pin").sort((a, b) => b.priority - a.priority);
  const boosts = new Map(rules.filter((r) => r.action === "boost").map((r) => [String(r.product?._id), r.priority || 1]));
  const buries = new Map(rules.filter((r) => r.action === "bury").map((r) => [String(r.product?._id), r.priority || 1]));

  const pinnedIds = pins.map((p) => String(p.product?._id)).filter(Boolean);
  const hitsByProduct = new Map(hits.map((h) => [String(h.product), h]));
  const missingPinIds = pinnedIds.filter((id) => !hitsByProduct.has(id));
  if (missingPinIds.length) {
    const fetched = await ProductSearchIndex.find({ product: { $in: missingPinIds }, isActive: true, isPublished: true }).lean();
    for (const doc of fetched) hitsByProduct.set(String(doc.product), doc);
  }

  const rest = hits.filter((h) => !pinnedIds.includes(String(h.product)));
  rest.forEach((h) => {
    const boost = boosts.get(String(h.product));
    const bury = buries.get(String(h.product));
    if (boost) h._score = (h._score || 1) * (1 + boost / 10);
    if (bury) h._score = (h._score || 1) / (1 + bury / 10);
  });
  rest.sort((a, b) => (b._score || 0) - (a._score || 0));

  const pinnedHits = pinnedIds.map((id) => hitsByProduct.get(id)).filter(Boolean);
  return [...pinnedHits, ...rest];
}

export async function listRules(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  return SearchRule.find(filter).sort({ createdAt: -1 }).populate("product", "name slug");
}

export async function createRule(userId, body) {
  return SearchRule.create({ ...body, createdBy: userId });
}

export async function updateRule(id, body) {
  return SearchRule.findByIdAndUpdate(id, body, { new: true });
}

export async function deleteRule(id) {
  await SearchRule.findByIdAndDelete(id);
}
