import Page from "../../models/Page.js";
import { validateBlocks } from "./blockRegistry.js";
import { isReservedSlug } from "../../utils/reservedSlugs.js";
import { assertValidContentTransition } from "../../utils/contentStateMachine.js";
import { validatePageForPublish } from "./publishValidationService.js";
import { recordRevision, listRevisions, getRevision } from "./revisionService.js";
import { sanitizePlainText } from "../../utils/sanitizeText.js";
import { recordAdminAction } from "../admin/adminAuditService.js";
import * as eventBus from "../notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

async function assertSlugAvailable(slug, excludeId) {
  if (isReservedSlug(slug)) fail(`"${slug}" is a reserved route and can't be used as a page slug`, "RESERVED_SLUG", 400);
  const existing = await Page.findOne({ slug, _id: { $ne: excludeId } });
  if (existing) fail("A page with this slug already exists", "SLUG_TAKEN", 409);
}

function sanitizeBlocks(blocks) {
  return blocks.map((b) => (b.type === "richText" ? { ...b, data: { ...b.data, content: sanitizePlainText(b.data?.content) } } : b));
}

export async function createPage(authorId, { title, slug, pageType, blocks, seo }) {
  await assertSlugAvailable(slug);
  const validatedBlocks = sanitizeBlocks(validateBlocks(blocks || []));
  const page = await Page.create({ title, slug, pageType: pageType || "static", blocks: validatedBlocks, seo, author: authorId, status: "draft" });
  await recordRevision("page", page._id, 1, page.toObject(), authorId, "Initial draft");
  return page;
}

// Homepage is a singleton by convention (rule #24), not a unique index —
// getOrCreateHomepage lazily creates the one Page with pageType:
// "homepage" the first time it's needed, so a fresh deployment isn't
// missing a homepage row before an admin ever visits the CMS.
export async function getOrCreateHomepage(authorId) {
  let homepage = await Page.findOne({ pageType: "homepage" });
  if (!homepage) {
    homepage = await Page.create({ title: "Homepage", slug: "__homepage__", pageType: "homepage", blocks: [], status: "draft", author: authorId });
    await recordRevision("page", homepage._id, 1, homepage.toObject(), authorId, "Homepage initialized");
  }
  return homepage;
}

export async function getPage(id) {
  const page = await Page.findById(id);
  if (!page) fail("Page not found", "PAGE_NOT_FOUND", 404);
  return page;
}

export async function listPages({ status, pageType, search, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (pageType) filter.pageType = pageType;
  if (search) filter.title = { $regex: search, $options: "i" };
  const [pages, total] = await Promise.all([
    Page.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("author", "firstName lastName"),
    Page.countDocuments(filter),
  ]);
  return { pages, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// Saving a draft is the one place a page can be freely edited regardless
// of current status — but only while status is draft/in_review/approved
// (rule #77-ish draft-locking is NOT implemented — see docs/cms.md — this
// only guards against editing a PUBLISHED page's live document directly,
// which would bypass the revision/review flow entirely).
export async function updatePage(id, actorId, { title, slug, blocks, seo }) {
  const page = await getPage(id);
  if (page.status === "published" || page.status === "archived") {
    fail(`Cannot directly edit a "${page.status}" page — create a new draft revision instead`, "PAGE_NOT_EDITABLE", 409);
  }
  const before = page.toObject();

  if (slug && slug !== page.slug) await assertSlugAvailable(slug, id);
  if (title !== undefined) page.title = title;
  if (slug !== undefined) page.slug = slug;
  if (blocks !== undefined) page.blocks = sanitizeBlocks(validateBlocks(blocks));
  if (seo !== undefined) page.seo = seo;
  page.version += 1;
  await page.save();

  await recordRevision("page", page._id, page.version, page.toObject(), actorId, "Edited draft");
  await recordAdminAction({ actor: actorId, action: "CONTENT_UPDATED", entityType: "Page", entityId: page._id, before, after: page.toObject() }).catch(() => {});
  return page;
}

async function transition(id, actorId, toStatus, extra = {}) {
  const page = await getPage(id);
  assertValidContentTransition(page.status, toStatus);
  const fromStatus = page.status;

  if (toStatus === "published") {
    const issues = await validatePageForPublish(page);
    if (issues.length) {
      const err = new Error("This page has issues that must be fixed before publishing");
      err.statusCode = 409; err.code = "PUBLISH_VALIDATION_FAILED"; err.issues = issues;
      throw err;
    }
    page.publishedAt = new Date();
    page.publishedBy = actorId;
  }
  if (toStatus === "in_review") page.reviewedBy = undefined;
  if (toStatus === "approved") page.reviewedBy = actorId;
  if (toStatus === "scheduled") page.scheduledAt = extra.scheduledAt;

  page.status = toStatus;
  await page.save();

  await recordAdminAction({
    actor: actorId, action: `CONTENT_${toStatus.toUpperCase()}`, entityType: "Page", entityId: page._id,
    before: { status: fromStatus }, after: { status: toStatus },
  }).catch(() => {});
  if (toStatus === "published") {
    await eventBus.publish(EVENT_TYPES.CONTENT_PUBLISHED, { entityId: String(page._id), title: page.title, slug: page.slug }, { source: "cms" });
  }
  return page;
}

export const submitForReview = (id, actorId) => transition(id, actorId, "in_review");
export const approve = (id, actorId) => transition(id, actorId, "approved");
export const publish = (id, actorId) => transition(id, actorId, "published");
export const schedule = (id, actorId, scheduledAt) => transition(id, actorId, "scheduled", { scheduledAt });
export const archive = (id, actorId) => transition(id, actorId, "archived");
export const restore = (id, actorId) => transition(id, actorId, "draft");
export const sendBackToDraft = (id, actorId) => transition(id, actorId, "draft");

// Scheduled publishing (rule #78/#79) — no background job scheduler exists
// in this project (same limitation noted since Phase 5), so this is
// checked lazily: called from the public content API's read path and
// exposable as an admin-triggered "run scheduler now" endpoint, rather
// than a real cron. Documented explicitly as the honest gap in docs/cms.md.
export async function processScheduledPages() {
  const due = await Page.find({ status: "scheduled", scheduledAt: { $lte: new Date() } });
  let published = 0;
  for (const page of due) {
    try {
      const issues = await validatePageForPublish(page);
      if (issues.length) continue; // leave it scheduled — an admin needs to fix it
      page.status = "published";
      page.publishedAt = new Date();
      await page.save();
      published += 1;
    } catch { /* skip, retry next run */ }
  }
  return { checked: due.length, published };
}

export async function duplicatePage(id, actorId) {
  const original = await getPage(id);
  let slug = `${original.slug}-copy`;
  let n = 1;
  while (await Page.exists({ slug })) { n += 1; slug = `${original.slug}-copy-${n}`; }

  const copy = await Page.create({
    title: `${original.title} (Copy)`, slug, pageType: original.pageType,
    blocks: original.blocks, seo: original.seo, author: actorId, status: "draft",
  });
  await recordRevision("page", copy._id, 1, copy.toObject(), actorId, `Duplicated from ${original._id}`);
  return copy;
}

export { listRevisions as listPageRevisions };

// Restoring a revision creates a NEW draft/revision (rule #74) — it never
// deletes the revisions in between, and never silently republishes.
export async function restorePageRevision(id, version, actorId) {
  const page = await getPage(id);
  const revision = await getRevision("page", id, version);
  if (!revision) fail("Revision not found", "REVISION_NOT_FOUND", 404);

  const snap = revision.snapshot;
  page.title = snap.title;
  page.blocks = snap.blocks;
  page.seo = snap.seo;
  page.status = "draft"; // restoring never republishes directly — goes back through review/publish
  page.version += 1;
  await page.save();

  await recordRevision("page", page._id, page.version, page.toObject(), actorId, `Restored from v${version}`);
  return page;
}

export { fail };
