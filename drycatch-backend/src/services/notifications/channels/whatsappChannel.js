import User from "../../../models/User.js";
import NotificationSuppression from "../../../models/NotificationSuppression.js";
import { getWhatsAppProvider } from "../providers/whatsappProvider.js";

export async function resolveRecipient(userId) {
  if (!userId) return null;
  const user = await User.findById(userId, "phone");
  return user?.phone || null;
}

export async function send({ recipient, body }) {
  const suppressed = await NotificationSuppression.findOne({ channel: "sms", value: recipient }); // WhatsApp shares the phone-based suppression list
  if (suppressed) return { success: false, status: "cancelled", error: `suppressed (${suppressed.reason})`, errorClass: "permanent" };
  try {
    const provider = getWhatsAppProvider();
    const result = await provider.send({ to: recipient, body });
    return { success: true, providerMessageId: result.providerMessageId, status: "sent", provider: provider.name };
  } catch (err) {
    return { success: false, status: "failed", error: err.message, errorClass: err.errorClass || "temporary", provider: getWhatsAppProvider().name };
  }
}
