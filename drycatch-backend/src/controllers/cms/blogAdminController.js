import * as blogService from "../../services/cms/blogService.js";
import * as eventBus from "../../services/notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

export async function listBlogPosts(req, res) {
  res.json(await blogService.listBlogPosts(req.query));
}
export async function getBlogPost(req, res) {
  res.json({ post: await blogService.getBlogPost(req.params.id) });
}
export async function createBlogPost(req, res) {
  res.status(201).json({ post: await blogService.createBlogPost(req.user._id, req.body) });
}
export async function updateBlogPost(req, res) {
  res.json({ post: await blogService.updateBlogPost(req.params.id, req.user._id, req.body) });
}
export async function submitForReview(req, res) {
  res.json({ post: await blogService.submitForReview(req.params.id, req.user._id) });
}
export async function approve(req, res) {
  res.json({ post: await blogService.approve(req.params.id, req.user._id) });
}
export async function publish(req, res) {
  try {
    res.json({ post: await blogService.publish(req.params.id, req.user._id) });
  } catch (err) {
    await eventBus.publish(EVENT_TYPES.CONTENT_PUBLISH_FAILED, { entityId: req.params.id, error: err.message }, { source: "cms" });
    throw err;
  }
}
export async function schedule(req, res) {
  res.json({ post: await blogService.schedule(req.params.id, req.user._id, req.body.scheduledAt) });
}
export async function archive(req, res) {
  res.json({ post: await blogService.archive(req.params.id, req.user._id) });
}
export async function restore(req, res) {
  res.json({ post: await blogService.restore(req.params.id, req.user._id) });
}
export async function listRevisions(req, res) {
  res.json({ revisions: await blogService.listBlogRevisions("blog", req.params.id) });
}
export async function restoreRevision(req, res) {
  res.json({ post: await blogService.restoreBlogRevision(req.params.id, Number(req.params.version), req.user._id) });
}
export async function runScheduler(req, res) {
  res.json(await blogService.processScheduledPosts());
}
