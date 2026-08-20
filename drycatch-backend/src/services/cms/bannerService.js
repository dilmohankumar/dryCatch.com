import Banner from "../../models/Banner.js";

export async function listBanners({ status, target } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (target) filter.target = target;
  return Banner.find(filter).sort({ priority: -1, createdAt: -1 }).populate("image mobileImage");
}

// Schedule enforcement happens HERE, at read time (rule #39) — no
// background job flips `status` automatically (same lazy-check pattern as
// Checkout/Cart expiry elsewhere in this project).
export async function getActiveBanners({ target = "homepage", targetId } = {}) {
  const now = new Date();
  const filter = {
    status: "active", target,
    $and: [
      { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] },
    ],
  };
  if (targetId) filter.targetId = targetId;
  return Banner.find(filter).sort({ priority: -1 }).populate("image mobileImage");
}

export async function createBanner(data) {
  return Banner.create(data);
}

export async function updateBanner(id, data) {
  const banner = await Banner.findByIdAndUpdate(id, data, { new: true });
  if (!banner) throw Object.assign(new Error("Banner not found"), { statusCode: 404, code: "BANNER_NOT_FOUND" });
  return banner;
}

export async function deleteBanner(id) {
  await Banner.findByIdAndUpdate(id, { status: "inactive" }); // soft — never hard-delete (rule #118)
}

// Impression/click tracking (rule #93) — server-side counters, never
// trusted from frontend UI state alone.
export async function trackImpression(id) {
  await Banner.updateOne({ _id: id }, { $inc: { impressions: 1 } });
}
export async function trackClick(id) {
  await Banner.updateOne({ _id: id }, { $inc: { clicks: 1 } });
}
