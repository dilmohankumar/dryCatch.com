import NotificationTemplate from "../../models/NotificationTemplate.js";
import NotificationTemplateRevision from "../../models/NotificationTemplateRevision.js";
import { renderTemplate, validateVariables, extractVariables } from "../../utils/templateRenderer.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Fallback resolution (rule #85/#143): store-specific -> tenant -> platform
// default. This project is single-tenant/single-store today, so there is
// only ever one row per (type, channel, locale) — the fallback chain is
// implemented (locale fallback below) but the store/tenant tiers collapse
// to a no-op until multi-store is real, documented rather than built
// speculatively.
export async function resolveTemplate(type, channel, locale = "en-IN") {
  return (
    (await NotificationTemplate.findOne({ type, channel, locale, status: "published" })) ||
    (await NotificationTemplate.findOne({ type, channel, locale: "en-IN", status: "published" })) || // fallback language (rule #41)
    null
  );
}

export async function createTemplate(data, actorId) {
  const declaredVars = data.variables?.length ? data.variables : extractVariables(data.body);
  validateVariables(data.body, declaredVars);
  const template = await NotificationTemplate.create({ ...data, variables: declaredVars, createdBy: actorId, updatedBy: actorId });
  await NotificationTemplateRevision.create({ template: template._id, version: template.version, snapshot: template.toObject(), savedBy: actorId });
  return template;
}

export async function updateTemplate(id, updates, actorId) {
  const template = await NotificationTemplate.findById(id);
  if (!template) fail("Template not found", "TEMPLATE_NOT_FOUND");
  const nextBody = updates.body ?? template.body;
  const nextVars = updates.variables ?? template.variables;
  validateVariables(nextBody, nextVars); // rule #142 — cannot save a template with an undeclared variable

  Object.assign(template, updates, { updatedBy: actorId, version: template.version + 1 });
  await template.save();
  await NotificationTemplateRevision.create({ template: template._id, version: template.version, snapshot: template.toObject(), savedBy: actorId });
  return template;
}

export async function publishTemplate(id, actorId) {
  return updateTemplate(id, { status: "published" }, actorId);
}

export async function listTemplateRevisions(templateId) {
  return NotificationTemplateRevision.find({ template: templateId }).sort({ version: -1 });
}

// Restore-creates-new-revision (same semantics as CMS, rule #39) — never
// rewrites history.
export async function restoreTemplateRevision(templateId, revisionId, actorId) {
  const revision = await NotificationTemplateRevision.findOne({ _id: revisionId, template: templateId });
  if (!revision) fail("Revision not found", "REVISION_NOT_FOUND");
  const { subject, body, variables } = revision.snapshot;
  return updateTemplate(templateId, { subject, body, variables, status: "draft" }, actorId);
}

export function preview(template, sampleData = {}) {
  return {
    subject: template.subject ? renderTemplate(template.subject, sampleData) : undefined,
    body: renderTemplate(template.body, sampleData),
  };
}

export async function renderForEvent(type, channel, context, locale = "en-IN") {
  const template = await resolveTemplate(type, channel, locale);
  if (!template) return null;
  validateVariables(template.body, Object.keys(context)); // fail fast if the event payload is missing something the template needs
  return {
    subject: template.subject ? renderTemplate(template.subject, context) : undefined,
    body: renderTemplate(template.body, context),
  };
}
