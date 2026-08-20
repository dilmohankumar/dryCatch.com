import RecentlyViewed from "../../models/RecentlyViewed.js";

const MAX_TRACKED_PER_VIEWER = 50; // cap what's stored; only the most recent N are ever shown anyway (rule #18 "configurable retention")
const DEFAULT_LIMIT = 10;

function viewerFilter(userId, anonymousId) {
  return userId ? { user: userId } : { anonymousId };
}

// Called on every PRODUCT_VIEW (rule #18) — upserts so re-viewing a
// product just bumps its recency instead of creating duplicate rows.
export async function recordView({ userId, anonymousId, productId }) {
  if (!userId && !anonymousId) return; // nothing to key the record by
  const filter = { ...viewerFilter(userId, anonymousId), product: productId };
  await RecentlyViewed.findOneAndUpdate(filter, { $set: { viewedAt: new Date() } }, { upsert: true });

  // Trim to the cap — cheap at this volume (a handful of deletes per
  // view, at most, once a viewer exceeds the cap) and keeps the
  // collection from growing unbounded per viewer.
  const count = await RecentlyViewed.countDocuments(viewerFilter(userId, anonymousId));
  if (count > MAX_TRACKED_PER_VIEWER) {
    const excess = await RecentlyViewed.find(viewerFilter(userId, anonymousId))
      .sort({ viewedAt: 1 })
      .limit(count - MAX_TRACKED_PER_VIEWER)
      .select("_id");
    await RecentlyViewed.deleteMany({ _id: { $in: excess.map((d) => d._id) } });
  }
}

export async function listRecentlyViewed({ userId, anonymousId, limit = DEFAULT_LIMIT, excludeProductId }) {
  if (!userId && !anonymousId) return [];
  const filter = viewerFilter(userId, anonymousId);
  if (excludeProductId) filter.product = { $ne: excludeProductId };
  const rows = await RecentlyViewed.find(filter)
    .sort({ viewedAt: -1 })
    .limit(Math.min(Number(limit) || DEFAULT_LIMIT, 50))
    .populate({ path: "product", match: { status: "active", visibility: "public" }, select: "name slug price mrp media rating reviewsCount" });
  return rows.map((r) => r.product).filter(Boolean); // a since-archived/deleted product is silently dropped, not shown broken
}

// Called once at login (mirrors Phase 6's guest-cart-merge pattern) — a
// guest's browsing history becomes theirs once they're identified, rather
// than starting over.
export async function mergeAnonymousIntoUser(anonymousId, userId) {
  if (!anonymousId) return;
  const guestRows = await RecentlyViewed.find({ anonymousId });
  for (const row of guestRows) {
    const existing = await RecentlyViewed.findOne({ user: userId, product: row.product });
    if (existing) {
      if (row.viewedAt > existing.viewedAt) {
        existing.viewedAt = row.viewedAt;
        await existing.save();
      }
      await row.deleteOne();
    } else {
      row.user = userId;
      row.anonymousId = undefined;
      await row.save();
    }
  }
}

