// Small, dependency-free edit-distance implementation — used only for
// "did you mean" suggestions on a zero-result search (rule #48), not for
// fuzzy matching within the main query (that stays controlled/exact via
// Mongo's $text index, per rule #12's "do not make fuzzy matching so broad
// that irrelevant products appear").
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Finds the closest candidate within maxDistance, or null.
export function closestMatch(term, candidates, maxDistance = 2) {
  let best = null;
  let bestDistance = maxDistance + 1;
  for (const candidate of candidates) {
    const d = levenshtein(term, candidate);
    if (d < bestDistance) { bestDistance = d; best = candidate; }
  }
  return bestDistance <= maxDistance ? best : null;
}
