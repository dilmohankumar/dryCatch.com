import * as pageService from "../../services/cms/pageService.js";
import * as eventBus from "../../services/notifications/eventBus.js";
import { EVENT_TYPES } from "../../utils/notificationEvents.js";

export async function listPages(req, res) {
  res.json(await pageService.listPages(req.query));
}
export async function getPage(req, res) {
  res.json({ page: await pageService.getPage(req.params.id) });
}
export async function getHomepage(req, res) {
  res.json({ page: await pageService.getOrCreateHomepage(req.user._id) });
}
export async function createPage(req, res) {
  res.status(201).json({ page: await pageService.createPage(req.user._id, req.body) });
}
export async function updatePage(req, res) {
  res.json({ page: await pageService.updatePage(req.params.id, req.user._id, req.body) });
}
export async function submitForReview(req, res) {
  res.json({ page: await pageService.submitForReview(req.params.id, req.user._id) });
}
export async function approve(req, res) {
  res.json({ page: await pageService.approve(req.params.id, req.user._id) });
}
export async function publish(req, res) {
  try {
    res.json({ page: await pageService.publish(req.params.id, req.user._id) });
  } catch (err) {
    // Publish-time validation failures never reach pageService's own
    // eventBus.publish() call (rule #16: there is no persisted-state hook
    // to fire CONTENT_PUBLISH_FAILED from inside the service, since it just
    // throws before saving) — caught here at the boundary instead.
    await eventBus.publish(EVENT_TYPES.CONTENT_PUBLISH_FAILED, { entityId: req.params.id, error: err.message }, { source: "cms" });
    throw err;
  }
}
export async function schedule(req, res) {
  res.json({ page: await pageService.schedule(req.params.id, req.user._id, req.body.scheduledAt) });
}
export async function archive(req, res) {
  res.json({ page: await pageService.archive(req.params.id, req.user._id) });
}
export async function restore(req, res) {
  res.json({ page: await pageService.restore(req.params.id, req.user._id) });
}
export async function sendBackToDraft(req, res) {
  res.json({ page: await pageService.sendBackToDraft(req.params.id, req.user._id) });
}
export async function duplicatePage(req, res) {
  res.status(201).json({ page: await pageService.duplicatePage(req.params.id, req.user._id) });
}
export async function listRevisions(req, res) {
  res.json({ revisions: await pageService.listPageRevisions("page", req.params.id) });
}
export async function restoreRevision(req, res) {
  res.json({ page: await pageService.restorePageRevision(req.params.id, Number(req.params.version), req.user._id) });
}
export async function runScheduler(req, res) {
  res.json(await pageService.processScheduledPages());
}
