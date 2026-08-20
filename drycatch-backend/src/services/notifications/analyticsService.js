import Notification from "../../models/Notification.js";
import NotificationDelivery from "../../models/NotificationDelivery.js";

// Transactional and marketing analytics are tracked separately (rule #101)
// — a `category` filter is required by the caller (controller passes it
// explicitly), never mixed silently into one aggregate.
export async function getDeliveryStats({ category, since } = {}) {
  const notificationFilter = {};
  if (category) notificationFilter.category = category;
  if (since) notificationFilter.createdAt = { $gte: since };

  const notifications = await Notification.find(notificationFilter, "_id");
  const notificationIds = notifications.map((n) => n._id);

  const rows = await NotificationDelivery.aggregate([
    { $match: { notification: { $in: notificationIds } } },
    { $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } },
  ]);

  const stats = {};
  for (const row of rows) {
    const { channel, status } = row._id;
    stats[channel] = stats[channel] || {};
    stats[channel][status] = row.count;
  }
  return stats;
}

export async function getQueueHealth() {
  const [retrying, failed, pending, processing] = await Promise.all([
    NotificationDelivery.countDocuments({ status: "retrying" }),
    NotificationDelivery.countDocuments({ status: "failed" }),
    NotificationDelivery.countDocuments({ status: "pending" }),
    NotificationDelivery.countDocuments({ status: "processing" }),
  ]);
  return { retrying, dlq: failed, pending, processing };
}

export async function getCampaignAnalytics(campaignId) {
  const notifications = await Notification.find({ "data.campaignId": String(campaignId) }, "_id");
  const notificationIds = notifications.map((n) => n._id);
  const deliveries = await NotificationDelivery.find({ notification: { $in: notificationIds } });

  const recipients = new Set(notifications.map((n) => String(n._id))).size;
  const sent = deliveries.filter((d) => ["sent", "delivered"].includes(d.status)).length;
  const delivered = deliveries.filter((d) => d.status === "delivered").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;
  const opened = deliveries.filter((d) => d.openedAt).length;
  const clicked = deliveries.filter((d) => d.clickedAt).length;

  return {
    recipients,
    sent,
    delivered,
    failed,
    opened,
    clicked,
    ctr: sent > 0 ? Number(((clicked / sent) * 100).toFixed(2)) : 0,
  };
}
