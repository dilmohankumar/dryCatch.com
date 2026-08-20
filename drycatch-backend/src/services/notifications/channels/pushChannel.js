import NotificationDevice from "../../../models/NotificationDevice.js";
import { getPushProvider } from "../providers/pushProvider.js";

// Push (and web push — same channel contract, rule #15) fans out to every
// active device the user has registered (rule #97), not just one token.
export async function resolveDevices(userId) {
  return NotificationDevice.find({ user: userId, status: "active" });
}

export async function send({ device, title, body, data }) {
  try {
    const provider = getPushProvider();
    const result = await provider.send({ to: device.pushToken, title, body, data });
    return { success: true, providerMessageId: result.providerMessageId, status: "sent", provider: provider.name };
  } catch (err) {
    // A permanently invalid token should be marked so it stops being tried.
    if (err.code === "INVALID_TOKEN") await NotificationDevice.updateOne({ _id: device._id }, { status: "invalid" });
    return { success: false, status: "failed", error: err.message, errorClass: err.errorClass || "temporary", provider: getPushProvider().name };
  }
}
