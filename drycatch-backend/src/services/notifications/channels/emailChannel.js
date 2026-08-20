import User from "../../../models/User.js";
import NotificationSuppression from "../../../models/NotificationSuppression.js";
import { getEmailProvider } from "../providers/emailProvider.js";

// Consistent channel contract (rule #93): every channel exposes
// resolveRecipient() + send(), and always returns the same shape —
// { success, providerMessageId, status, error, errorClass } — so
// deliveryService never needs to know which channel it's driving.
export async function resolveRecipient(userId) {
  if (!userId) return null;
  const user = await User.findById(userId, "email");
  return user?.email || null;
}

export async function send({ recipient, subject, body }) {
  const suppressed = await NotificationSuppression.findOne({ channel: "email", value: recipient });
  if (suppressed) {
    return { success: false, status: "cancelled", error: `suppressed (${suppressed.reason})`, errorClass: "permanent" };
  }
  try {
    const provider = getEmailProvider();
    const result = await provider.send({ to: recipient, subject, body });
    return { success: true, providerMessageId: result.providerMessageId, status: "sent", provider: provider.name };
  } catch (err) {
    return { success: false, status: "failed", error: err.message, errorClass: err.errorClass || "temporary", provider: getEmailProvider().name };
  }
}
