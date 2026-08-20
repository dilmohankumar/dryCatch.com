import Notification from "../../models/Notification.js";

function fail(message, code, statusCode = 404) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Customer-facing reads (rules #76-81). Expired notifications never show
// (rule #80) — filtered at the query level, not client-side.
function baseFilter(userId) {
  return { user: userId, archivedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
}

export async function listNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const filter = baseFilter(userId);
  if (unreadOnly) filter.readAt = null;
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Notification.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

// Cheap dedicated count query (rule #77) — never loads full notification
// documents just to report a badge number.
export async function getUnreadCount(userId) {
  const filter = baseFilter(userId);
  filter.readAt = null;
  return Notification.countDocuments(filter);
}

export async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOne({ _id: notificationId, user: userId }); // ownership check (rule #78) — a user cannot mark another user's notification read
  if (!notification) fail("Notification not found", "NOTIFICATION_NOT_FOUND");
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  return notification;
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } }); // strictly scoped to the authenticated user (rule #79)
  return { modified: result.modifiedCount };
}

export async function archiveNotification(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  if (!notification) fail("Notification not found", "NOTIFICATION_NOT_FOUND");
  return notification;
}

// Admin-facing equivalent — admin/system notifications have no single
// owning user, so this reads by recipientType instead of ownership.
export async function listAdminNotifications({ page = 1, limit = 20, category } = {}) {
  const filter = { recipientType: "admin" };
  if (category) filter.category = category;
  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    Notification.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}
