// Final Score = Text Relevance + Popularity Boost + Rating Signal +
// Freshness Signal + Availability penalty (rule #41). Kept as one small,
// configurable function — not scattered inline in the query — so the
// weights can be tuned after real search analytics without touching
// searchService's control flow (rule #8: "tune after real search
// analytics, do not assume these numbers are final").
export const RANKING_WEIGHTS = {
  textScore: 1,
  popularity: 0.15,
  rating: 0.2,
  freshnessDays: 30, // products newer than this get a small, decaying boost
  freshnessWeight: 0.1,
  outOfStockPenalty: 0.5, // rule #105 — demoted, not necessarily hidden
};

export function computeScore(hit, { hasTextQuery }) {
  const textScore = hasTextQuery ? (hit.score || 0) : 1; // no query = every browsing/filter result starts even
  const popularityScore = Math.log10((hit.popularity || 0) + 1);
  const ratingScore = (hit.rating || 0) / 5;

  const ageDays = (Date.now() - new Date(hit.createdAt || hit.updatedAt || Date.now()).getTime()) / 86400000;
  const freshness = ageDays < RANKING_WEIGHTS.freshnessDays
    ? (RANKING_WEIGHTS.freshnessDays - ageDays) / RANKING_WEIGHTS.freshnessDays
    : 0;

  let score =
    textScore * RANKING_WEIGHTS.textScore +
    popularityScore * RANKING_WEIGHTS.popularity +
    ratingScore * RANKING_WEIGHTS.rating +
    freshness * RANKING_WEIGHTS.freshnessWeight;

  // Relevance stays primary — rule #107: "do not make a 5-star product
  // automatically rank above a highly relevant product." Rating only ever
  // contributes a small additive fraction, never multiplies or overrides
  // the text-match score.
  if (hit.inventoryStatus === "out_of_stock") score *= (1 - RANKING_WEIGHTS.outOfStockPenalty);

  return score;
}

export function rankHits(hits, { hasTextQuery }) {
  return hits
    .map((h) => ({ ...h, _score: computeScore(h, { hasTextQuery }) }))
    .sort((a, b) => b._score - a._score);
}
