// Plain-JS cosine similarity. Vectors are treated as dense arrays.
// Works for any dimensionality as long as both vectors share it.

export function l2norm(vec) {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  return Math.sqrt(s) || 1e-12;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}

// Top-k by cosine. Returns array of { index, score } sorted desc.
export function topK(queryVec, matrix, k = 5) {
  const scored = matrix.map((vec, index) => ({ index, score: cosine(queryVec, vec) }));
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}
