export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Appends -2, -3, ... until `exists(candidate)` returns false. `exists` is
// caller-supplied (a DB existence check) so this stays storage-agnostic.
export async function generateUniqueSlug(name, exists) {
  const base = slugify(name) || "item";
  let candidate = base;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
