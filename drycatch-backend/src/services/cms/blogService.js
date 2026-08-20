import BlogPost from "../../models/BlogPost.js";
import MediaAsset from "../../models/MediaAsset.js";
import { isReservedSlug } from "../../utils/reservedSlugs.js";
import { assertValidContentTransition } from "../../utils/contentStateMachine.js";
import { recordRevision, listRevisions, getRevision } from "./revisionService.js";
import { sanitizePlainText } from "../../utils/sanitizeText.js";
import { recordAdminAction } from "../admin/adminAuditService.js";
import * as eventBus from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

async function assertSlugAvailable(slug, excludeId) {
  if (isReservedSlug(slug)) fail(`"${slug}" is a reserved route and can't be used as a blog slug`, "RESERVED_SLUG", 400);
  const existing = await BlogPost.findOne({ slug, _id: { $ne: excludeId } });
  if (existing) fail("A blog post with this slug already exists", "SLUG_TAKEN", 409);
}

export async function createBlogPost(authorId, { title, slug, excerpt, content, featuredImage, category, tags, seo }) {
  await assertSlugAvailable(slug);
  const post = await BlogPost.create({
    title, slug, excerpt: sanitizePlainText(excerpt), content, featuredImage, category, tags, seo,
    author: authorId, status: "draft",
  });
  await recordRevision("blog", post._id, 1, post.toObject(), authorId, "Initial draft");
  return post;
}

export async function getBlogPost(id) {
  const post = await BlogPost.findById(id);
  if (!post) fail("Blog post not found", "BLOG_NOT_FOUND", 404);
  return post;
}

export async function listBlogPosts({ status, category, tag, search, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (search) filter.title = { $regex: search, $options: "i" };
  const [posts, total] = await Promise.all([
    BlogPost.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("author", "firstName lastName").populate("featuredImage"),
    BlogPost.countDocuments(filter),
  ]);
  return { posts, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export async function updateBlogPost(id, actorId, { title, slug, excerpt, content, featuredImage, category, tags, seo }) {
  const post = await getBlogPost(id);
  if (post.status === "published" || post.status === "archived") {
    fail(`Cannot directly edit a "${post.status}" post — create a new draft revision instead`, "BLOG_NOT_EDITABLE", 409);
  }
  const before = post.toObject();

  if (slug && slug !== post.slug) await assertSlugAvailable(slug, id);
  if (title !== undefined) post.title = title;
  if (slug !== undefined) post.slug = slug;
  if (excerpt !== undefined) post.excerpt = sanitizePlainText(excerpt);
  if (content !== undefined) post.content = content;
  if (featuredImage !== undefined) post.featuredImage = featuredImage;
  if (category !== undefined) post.category = category;
  if (tags !== undefined) post.tags = tags;
  if (seo !== undefined) post.seo = seo;
  post.version += 1;
  await post.save();

  await recordRevision("blog", post._id, post.version, post.toObject(), actorId, "Edited draft");
  await recordAdminAction({ actor: actorId, action: "CONTENT_UPDATED", entityType: "BlogPost", entityId: post._id, before, after: post.toObject() }).catch(() => {});
  return post;
}

async function validateForPublish(post) {
  const issues = [];
  if (!post.title) issues.push({ code: "MISSING_TITLE", message: "Title is required" });
  if (!post.content?.length) issues.push({ code: "NO_CONTENT", message: "Post has no content" });
  if (post.featuredImage) {
    const exists = await MediaAsset.exists({ _id: post.featuredImage, status: "ready" });
    if (!exists) issues.push({ code: "BROKEN_MEDIA_REFERENCE", message: "Featured image is missing/archived" });
  }
  return issues;
}

async function transition(id, actorId, toStatus, extra = {}) {
  const post = await getBlogPost(id);
  assertValidContentTransition(post.status, toStatus);
  const fromStatus = post.status;

  if (toStatus === "published") {
    const issues = await validateForPublish(post);
    if (issues.length) {
      const err = new Error("This post has issues that must be fixed before publishing");
      err.statusCode = 409; err.code = "PUBLISH_VALIDATION_FAILED"; err.issues = issues;
      throw err;
    }
    post.publishedAt = new Date();
    post.publishedBy = actorId;
  }
  if (toStatus === "approved") post.reviewedBy = actorId;
  if (toStatus === "scheduled") post.scheduledAt = extra.scheduledAt;

  post.status = toStatus;
  await post.save();

  await recordAdminAction({
    actor: actorId, action: `CONTENT_${toStatus.toUpperCase()}`, entityType: "BlogPost", entityId: post._id,
    before: { status: fromStatus }, after: { status: toStatus },
  }).catch(() => {});
  if (toStatus === "published") {
    await eventBus.publish(EVENT_TYPES.CONTENT_PUBLISHED, { entityId: String(post._id), title: post.title, slug: post.slug }, { source: "cms" });
  }
  return post;
}

export const submitForReview = (id, actorId) => transition(id, actorId, "in_review");
export const approve = (id, actorId) => transition(id, actorId, "approved");
export const publish = (id, actorId) => transition(id, actorId, "published");
export const schedule = (id, actorId, scheduledAt) => transition(id, actorId, "scheduled", { scheduledAt });
export const archive = (id, actorId) => transition(id, actorId, "archived");
export const restore = (id, actorId) => transition(id, actorId, "draft");

export async function processScheduledPosts() {
  const due = await BlogPost.find({ status: "scheduled", scheduledAt: { $lte: new Date() } });
  let published = 0;
  for (const post of due) {
    try {
      const issues = await validateForPublish(post);
      if (issues.length) continue;
      post.status = "published";
      post.publishedAt = new Date();
      await post.save();
      published += 1;
    } catch { /* skip, retry next run */ }
  }
  return { checked: due.length, published };
}

export { listRevisions as listBlogRevisions };

export async function restoreBlogRevision(id, version, actorId) {
  const post = await getBlogPost(id);
  const revision = await getRevision("blog", id, version);
  if (!revision) fail("Revision not found", "REVISION_NOT_FOUND", 404);

  const snap = revision.snapshot;
  post.title = snap.title; post.excerpt = snap.excerpt; post.content = snap.content; post.seo = snap.seo;
  post.status = "draft";
  post.version += 1;
  await post.save();

  await recordRevision("blog", post._id, post.version, post.toObject(), actorId, `Restored from v${version}`);
  return post;
}

export { fail };
