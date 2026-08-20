import * as notificationCenterService from "../services/notifications/notificationCenterService.js";
import * as preferenceService from "../services/notifications/preferenceService.js";
import * as deviceService from "../services/notifications/deviceService.js";

// Customer-facing Notification Center + preferences + device registration.
// Every read/write here is scoped to req.user._id — no notificationId or
// deviceId is ever trusted to belong to the caller without a query filter
// on user (rule #78 — IDOR prevention).
export async function listNotifications(req, res) {
  res.json(await notificationCenterService.listNotifications(req.user._id, req.query));
}

export async function getUnreadCount(req, res) {
  res.json({ count: await notificationCenterService.getUnreadCount(req.user._id) });
}

export async function markAsRead(req, res) {
  res.json(await notificationCenterService.markAsRead(req.user._id, req.params.id));
}

export async function markAllRead(req, res) {
  res.json(await notificationCenterService.markAllRead(req.user._id));
}

export async function archiveNotification(req, res) {
  res.json(await notificationCenterService.archiveNotification(req.user._id, req.params.id));
}

export async function getPreferences(req, res) {
  res.json(await preferenceService.getPreferences(req.user._id));
}

export async function updatePreferences(req, res) {
  res.json(await preferenceService.updatePreferences(req.user._id, req.body));
}

export async function unsubscribe(req, res) {
  res.json(await preferenceService.unsubscribeFromMarketing(req.user._id));
}

export async function registerDevice(req, res) {
  res.status(201).json(await deviceService.registerDevice(req.user._id, req.body));
}

export async function listDevices(req, res) {
  res.json({ devices: await deviceService.listDevices(req.user._id) });
}

export async function revokeDevice(req, res) {
  res.json(await deviceService.revokeDevice(req.user._id, req.params.deviceId));
}
