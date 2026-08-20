import NotificationSuppression from "../../models/NotificationSuppression.js";

export async function suppress({ channel, value, reason, user, notes }) {
  return NotificationSuppression.findOneAndUpdate(
    { channel, value },
    { $set: { reason, user, notes } },
    { upsert: true, new: true }
  );
}

export async function isSuppressed(channel, value) {
  if (!value) return false;
  return Boolean(await NotificationSuppression.findOne({ channel, value }));
}

export async function removeSuppression(channel, value) {
  return NotificationSuppression.deleteOne({ channel, value });
}

export async function listSuppressions({ channel, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (channel) filter.channel = channel;
  const [items, total] = await Promise.all([
    NotificationSuppression.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    NotificationSuppression.countDocuments(filter),
  ]);
  return { items, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}
