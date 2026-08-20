import NotificationCampaign from "../../models/NotificationCampaign.js";
import NotificationTemplate from "../../models/NotificationTemplate.js";
import NotificationPreference from "../../models/NotificationPreference.js";
import NotificationSuppression from "../../models/NotificationSuppression.js";
import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import { createAndProcessDeliveries } from "./deliveryService.js";
import { preview as renderPreview } from "./templateService.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Audience is a query DESCRIPTOR (rule #67), never a hard-coded list —
// resolved to actual users only at send time so it always reflects the
// current customer base.
const SEGMENT_QUERIES = {
  all: () => ({}),
  new_customers: () => ({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
  inactive: () => ({ lastLoginAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }),
  high_value: () => ({}), // requires order-total aggregation, not built yet — documented as Phase 17 readiness; resolves to "all" today rather than silently guessing
  custom: (filter) => filter || {},
};

async function resolveAudience(audience) {
  const query = (SEGMENT_QUERIES[audience.segment] || SEGMENT_QUERIES.all)(audience.filter);
  return User.find({ role: { $ne: "admin" }, ...query }, "_id email");
}

export async function createCampaign(data, actorId) {
  const template = await NotificationTemplate.findById(data.template);
  if (!template) fail("Template not found", "TEMPLATE_NOT_FOUND");
  return NotificationCampaign.create({ ...data, createdBy: actorId });
}

export async function updateCampaign(id, updates) {
  const campaign = await NotificationCampaign.findById(id);
  if (!campaign) fail("Campaign not found", "CAMPAIGN_NOT_FOUND");
  if (!["draft", "scheduled"].includes(campaign.status)) fail("Only draft/scheduled campaigns can be edited", "CAMPAIGN_NOT_EDITABLE", 409);
  Object.assign(campaign, updates);
  await campaign.save();
  return campaign;
}

export async function listCampaigns({ status, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    NotificationCampaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate("template", "name type"),
    NotificationCampaign.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export async function scheduleCampaign(id, { startAt, endAt, timezone }) {
  const campaign = await NotificationCampaign.findById(id);
  if (!campaign) fail("Campaign not found", "CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "draft") fail("Only a draft campaign can be scheduled", "CAMPAIGN_NOT_DRAFT", 409);
  campaign.startAt = startAt;
  campaign.endAt = endAt;
  campaign.timezone = timezone || campaign.timezone;
  campaign.status = "scheduled";
  await campaign.save();
  return campaign;
}

export async function pauseCampaign(id) {
  const campaign = await NotificationCampaign.findById(id);
  if (!campaign) fail("Campaign not found", "CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "running") fail("Only a running campaign can be paused", "CAMPAIGN_NOT_RUNNING", 409);
  campaign.status = "paused";
  await campaign.save();
  return campaign;
}

const MAX_MARKETING_PER_DAY = 1; // frequency limit (rule #70) — one marketing send per campaign-eligible channel per day per recipient, kept simple and centrally enforced

async function isWithinFrequencyLimit(userId, channel) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await Notification.countDocuments({ user: userId, category: "marketing", channels: channel, createdAt: { $gte: since } });
  return count < MAX_MARKETING_PER_DAY;
}

// Send is a SEPARATE permission from create/update in the controller
// (rule #107) — this function itself has no permission check; the
// controller enforces campaigns.send before calling it.
export async function sendCampaign(id, actorId) {
  const campaign = await NotificationCampaign.findById(id).populate("template");
  if (!campaign) fail("Campaign not found", "CAMPAIGN_NOT_FOUND");
  if (!["draft", "scheduled"].includes(campaign.status)) fail("Campaign already sent/running", "CAMPAIGN_NOT_SENDABLE", 409);

  campaign.status = "running";
  campaign.sentBy = actorId;
  await campaign.save();

  const recipients = await resolveAudience(campaign.audience);
  let sent = 0;
  let failed = 0;
  let unsubscribed = 0;

  for (const user of recipients) {
    const pref = await NotificationPreference.findOne({ user: user._id });
    if (pref?.unsubscribedAt) { unsubscribed++; continue; } // rule #69 — never send to unsubscribed users
    const suppressed = user.email && (await NotificationSuppression.findOne({ channel: "email", value: user.email }));
    if (suppressed) { unsubscribed++; continue; }

    for (const channel of campaign.channels) {
      const withinLimit = await isWithinFrequencyLimit(user._id, channel);
      if (!withinLimit) continue; // rule #70 — frequency cap, silently skip this channel for this user today

      const rendered = renderPreview(campaign.template, { customerName: user.name || "there" });
      const dedupeKey = `CAMPAIGN_${campaign._id}:${user._id}:${channel}`;
      const existing = await Notification.findOne({ dedupeKey });
      if (existing) continue;

      const notification = await Notification.create({
        user: user._id,
        recipientType: "customer",
        eventType: `CAMPAIGN_${campaign._id}`,
        category: "marketing",
        priority: "low",
        title: rendered.subject || campaign.name,
        body: rendered.body,
        data: { campaignId: String(campaign._id) },
        channels: [channel],
        dedupeKey,
      });
      const recipientAddr = channel === "email" ? user.email : undefined;
      const deliveries = await createAndProcessDeliveries(notification, { [channel]: recipientAddr });
      if (deliveries.some((d) => ["sent", "delivered"].includes(d.status))) sent++;
      else failed++;
    }
  }

  campaign.status = "completed";
  campaign.stats = { ...campaign.stats.toObject(), recipients: recipients.length, sent, failed, unsubscribed };
  await campaign.save();
  return campaign;
}
