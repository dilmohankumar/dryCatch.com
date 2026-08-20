import User from "../../../models/User.js";
import NotificationSuppression from "../../../models/NotificationSuppression.js";
import { getSmsProvider } from "../providers/smsProvider.js";

export async function resolveRecipient(userId) {
  if (!userId) return null;
  const user = await User.findById(userId, "phone");
  return user?.phone || null;
}

// SMS body is capped short (rule #44) — never the full email content.
export async function send({ recipient, body }) {
  const suppressed = await NotificationSuppression.findOne({ channel: "sms", value: recipient });
  if (suppressed) return { success: false, status: "cancelled", error: `suppressed (${suppressed.reason})`, errorClass: "permanent" };
  try {
    const provider = getSmsProvider();
    const result = await provider.send({ to: recipient, body: body.slice(0, 160) });
    return { success: true, providerMessageId: result.providerMessageId, status: "sent", provider: provider.name };
  } catch (err) {
    return { success: false, status: "failed", error: err.message, errorClass: err.errorClass || "temporary", provider: getSmsProvider().name };
  }
}
