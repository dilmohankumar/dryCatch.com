import MediaAsset from "../../models/MediaAsset.js";
import Page from "../../models/Page.js";
import BlogPost from "../../models/BlogPost.js";
import Banner from "../../models/Banner.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = {
  image: ["image/jpeg", "image/png", "image/webp"], // SVG deliberately excluded (rule #47/#54 — SVG XSS risk) unless a future sanitizer is added
  video: ["video/mp4", "video/webm"],
  document: ["application/pdf"],
};

// Same honest-gap shape as reviewService's media validation (Phase 12) —
// real limits, real MIME allow-list, but no actual file-content signature
// check (would require a real upload pipeline this project doesn't have).
export async function uploadMedia(userId, { filename, type, url, storageKey, mimeType, size, width, height, altText, caption }) {
  if (!ALLOWED_MIME[type]) fail("Unsupported media type", "MEDIA_INVALID", 400);
  if (!ALLOWED_MIME[type].includes(mimeType)) fail(`Unsupported MIME type for ${type}: ${mimeType}`, "MEDIA_INVALID", 400);
  const maxBytes = type === "image" ? MAX_IMAGE_BYTES : type === "video" ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
  if (size > maxBytes) fail(`File exceeds the ${maxBytes / 1024 / 1024}MB limit for ${type}`, "MEDIA_INVALID", 400);

  return MediaAsset.create({ filename, type, url, storageKey, mimeType, size, width, height, altText, caption, uploadedBy: userId });
}

export async function listMedia({ type, search, page = 1, limit = 50 } = {}) {
  const filter = { status: "ready" };
  if (type) filter.type = type;
  if (search) filter.filename = { $regex: search, $options: "i" };
  const [media, total] = await Promise.all([
    MediaAsset.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    MediaAsset.countDocuments(filter),
  ]);
  return { media, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// Usage tracking (rule #109) — a referenced asset can't be deleted out
// from under a live page/post/banner. Scans the handful of places a
// mediaId can appear; at this project's scale a full-text scan of block
// JSON is cheap and simpler than maintaining a separate usage-index table.
async function countUsages(mediaId) {
  const idStr = String(mediaId);
  const [pages, posts, banners] = await Promise.all([
    Page.countDocuments({ "blocks.data.image": mediaId }),
    BlogPost.countDocuments({ featuredImage: mediaId }),
    Banner.countDocuments({ $or: [{ image: mediaId }, { mobileImage: mediaId }] }),
  ]);
  return pages + posts + banners;
}

export async function deleteMedia(mediaId) {
  const usages = await countUsages(mediaId);
  if (usages > 0) fail("This media is still referenced by published or draft content and can't be deleted", "MEDIA_IN_USE", 409);
  const media = await MediaAsset.findByIdAndUpdate(mediaId, { status: "archived" }, { new: true });
  if (!media) fail("Media not found", "MEDIA_NOT_FOUND", 404);
  return media;
}

// Orphan detection (rule #110) — uploaded but never referenced anywhere.
export async function listOrphanedMedia({ page = 1, limit = 50 } = {}) {
  const all = await MediaAsset.find({ status: "ready" }).sort({ createdAt: -1 });
  const orphaned = [];
  for (const asset of all) {
    if ((await countUsages(asset._id)) === 0) orphaned.push(asset);
  }
  const start = (page - 1) * limit;
  return { media: orphaned.slice(start, start + limit), total: orphaned.length, page: Number(page), limit: Number(limit) };
}

export { fail };
