import NotificationDevice from "../../models/NotificationDevice.js";

function mask(token) {
  if (!token) return "";
  return token.length <= 8 ? "****" : `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`;
}

// Push tokens are sensitive operational identifiers (rule #96) — every
// read path here returns a masked token, never the raw value.
function toSafeShape(device) {
  const obj = device.toObject ? device.toObject() : device;
  return { ...obj, pushToken: mask(obj.pushToken) };
}

export async function registerDevice(userId, { deviceId, platform, pushToken, browser }) {
  const device = await NotificationDevice.findOneAndUpdate(
    { user: userId, deviceId },
    { $set: { platform, pushToken, browser, status: "active", lastSeenAt: new Date() } },
    { upsert: true, new: true }
  );
  return toSafeShape(device);
}

export async function listDevices(userId) {
  const devices = await NotificationDevice.find({ user: userId, status: "active" });
  return devices.map(toSafeShape);
}

export async function revokeDevice(userId, deviceId) {
  const device = await NotificationDevice.findOneAndUpdate({ user: userId, deviceId }, { $set: { status: "revoked" } }, { new: true });
  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404, code: "DEVICE_NOT_FOUND" });
  return toSafeShape(device);
}
