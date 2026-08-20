import Redirect from "../../models/Redirect.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

function normalize(path) {
  return String(path).trim().toLowerCase().replace(/\/+$/, "") || "/";
}

// Loop detection (rule #62): A -> B is fine; A -> B where B -> A already
// exists is not, and neither is a redirect pointing at itself. Checked
// against the EXISTING redirect table so a two-hop loop (A->B, B->C, C->A)
// is also caught, not just direct A<->B pairs.
async function assertNoLoop(source, destination) {
  if (normalize(source) === normalize(destination)) fail("A redirect cannot point to itself", "REDIRECT_LOOP", 400);

  const visited = new Set([normalize(source)]);
  let current = normalize(destination);
  for (let hops = 0; hops < 20; hops++) {
    if (visited.has(current)) fail("This redirect would create a loop", "REDIRECT_LOOP", 400);
    visited.add(current);
    const next = await Redirect.findOne({ source: current, status: "active" });
    if (!next) break;
    current = normalize(next.destination);
  }
}

export async function createRedirect(userId, { source, destination, statusCode }) {
  const normalizedSource = normalize(source);
  const existing = await Redirect.findOne({ source: normalizedSource });
  if (existing) fail("A redirect for this source path already exists", "REDIRECT_SOURCE_TAKEN", 409);
  await assertNoLoop(normalizedSource, destination);

  return Redirect.create({ source: normalizedSource, destination, statusCode, createdBy: userId });
}

export async function listRedirects({ status, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  const [redirects, total] = await Promise.all([
    Redirect.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Redirect.countDocuments(filter),
  ]);
  return { redirects, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export async function updateRedirect(id, { destination, statusCode, status }) {
  const redirect = await Redirect.findById(id);
  if (!redirect) fail("Redirect not found", "REDIRECT_NOT_FOUND", 404);
  if (destination !== undefined) { await assertNoLoop(redirect.source, destination); redirect.destination = destination; }
  if (statusCode !== undefined) redirect.statusCode = statusCode;
  if (status !== undefined) redirect.status = status;
  await redirect.save();
  return redirect;
}

export async function deleteRedirect(id) {
  await Redirect.findByIdAndDelete(id);
}

// Public resolution — what the storefront's 404 handler / router calls to
// check "is this actually a redirect" before showing a not-found page.
export async function resolveRedirect(path) {
  return Redirect.findOne({ source: normalize(path), status: "active" });
}

export { fail };
