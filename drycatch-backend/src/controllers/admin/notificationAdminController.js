import * as notificationCenterService from "../../services/notifications/notificationCenterService.js";
import * as templateService from "../../services/notifications/templateService.js";
import * as deliveryService from "../../services/notifications/deliveryService.js";
import * as campaignService from "../../services/notifications/campaignService.js";
import * as suppressionService from "../../services/notifications/suppressionService.js";
import * as analyticsService from "../../services/notifications/analyticsService.js";
import * as eventBus from "../../services/notifications/eventBus.js";
import NotificationDelivery from "../../models/NotificationDelivery.js";
import Notification from "../../models/Notification.js";
import NotificationTemplate from "../../models/NotificationTemplate.js";

// Admin Notification Center (rule #75/#139/#140).
export async function listAdminNotifications(req, res) {
  res.json(await notificationCenterService.listAdminNotifications(req.query));
}

export async function listDeliveries(req, res) {
  const { page = 1, limit = 50, status, channel } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  const [items, total] = await Promise.all([
    NotificationDelivery.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("notification", "title eventType category"),
    NotificationDelivery.countDocuments(filter),
  ]);
  res.json({ items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) });
}

export async function getDeliveryDetail(req, res) {
  const delivery = await NotificationDelivery.findById(req.params.id).populate("notification");
  if (!delivery) return res.status(404).json({ message: "Delivery not found" });
  res.json(delivery);
}

export async function listDeadLetter(req, res) {
  res.json(await deliveryService.listDeadLetter(req.query));
}

export async function retryDeadLetter(req, res) {
  res.json(await deliveryService.retryDeadLetter(req.params.id));
}

export async function cancelDeadLetter(req, res) {
  res.json(await deliveryService.cancelDeadLetter(req.params.id));
}

export async function processRetries(req, res) {
  res.json({ processed: await deliveryService.processRetries() }); // admin-triggered lazy retry pass (no real worker exists)
}

export async function reprocessPendingEvents(req, res) {
  res.json({ processed: await eventBus.reprocessPendingEvents() });
}

// Templates
export async function listTemplates(req, res) {
  const { type, channel } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (channel) filter.channel = channel;
  res.json({ templates: await NotificationTemplate.find(filter).sort({ type: 1, channel: 1 }) });
}

export async function createTemplate(req, res) {
  res.status(201).json(await templateService.createTemplate(req.body, req.user._id));
}

export async function updateTemplate(req, res) {
  res.json(await templateService.updateTemplate(req.params.id, req.body, req.user._id));
}

export async function publishTemplate(req, res) {
  res.json(await templateService.publishTemplate(req.params.id, req.user._id));
}

export async function listTemplateRevisions(req, res) {
  res.json({ revisions: await templateService.listTemplateRevisions(req.params.id) });
}

export async function restoreTemplateRevision(req, res) {
  res.json(await templateService.restoreTemplateRevision(req.params.id, req.params.revisionId, req.user._id));
}

export async function previewTemplate(req, res) {
  const template = await NotificationTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  res.json(templateService.preview(template, req.body.sampleData || {}));
}

// Test send (rule #108) — clearly labeled, requires permission, never a
// real production campaign send.
export async function sendTestNotification(req, res) {
  const { eventType, channel = "email" } = req.body;
  const template = await NotificationTemplate.findOne({ type: eventType, channel });
  const rendered = template ? templateService.preview(template, req.body.sampleData || {}) : { subject: `[TEST] ${eventType}`, body: "Test notification body." };
  const notification = await Notification.create({
    user: req.user._id,
    recipientType: "admin",
    eventType: `TEST_${eventType}`,
    category: "system",
    priority: "low",
    title: `[TEST] ${rendered.subject || eventType}`,
    body: rendered.body,
    channels: [channel],
  });
  const deliveries = await deliveryService.createAndProcessDeliveries(notification, { [channel]: req.user.email });
  res.json({ notification, deliveries });
}

// Preferences overview / suppression management
export async function listSuppressions(req, res) {
  res.json(await suppressionService.listSuppressions(req.query));
}

export async function removeSuppression(req, res) {
  await suppressionService.removeSuppression(req.params.channel, req.params.value);
  res.json({ success: true });
}

// Campaigns
export async function listCampaigns(req, res) {
  res.json(await campaignService.listCampaigns(req.query));
}

export async function createCampaign(req, res) {
  res.status(201).json(await campaignService.createCampaign(req.body, req.user._id));
}

export async function updateCampaign(req, res) {
  res.json(await campaignService.updateCampaign(req.params.id, req.body));
}

export async function scheduleCampaign(req, res) {
  res.json(await campaignService.scheduleCampaign(req.params.id, req.body));
}

export async function pauseCampaign(req, res) {
  res.json(await campaignService.pauseCampaign(req.params.id));
}

export async function sendCampaignNow(req, res) {
  res.json(await campaignService.sendCampaign(req.params.id, req.user._id));
}

export async function getCampaignAnalytics(req, res) {
  res.json(await analyticsService.getCampaignAnalytics(req.params.id));
}

// Provider config — never returns full secrets (rule #145).
export async function getProviderConfig(req, res) {
  const mask = (v) => (v ? `********${v.slice(-4)}` : null);
  res.json({
    email: { provider: process.env.EMAIL_PROVIDER || "console", apiKey: mask(process.env.EMAIL_API_KEY) },
    sms: { provider: process.env.SMS_PROVIDER || "console", apiKey: mask(process.env.SMS_API_KEY) },
    push: { provider: process.env.PUSH_PROVIDER || "console" },
    whatsapp: { provider: process.env.WHATSAPP_PROVIDER || "console" },
  });
}

// Analytics
export async function getDeliveryStats(req, res) {
  res.json(await analyticsService.getDeliveryStats(req.query));
}

export async function getQueueHealth(req, res) {
  res.json(await analyticsService.getQueueHealth());
}
