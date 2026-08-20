// Honest stub, same shape as email/sms providers — console is real/working
// (used for both native push and web push readiness), FCM/APNs are
// structural stubs pending credentials + an SDK.
class ConsolePushProvider {
  name = "console";
  async send({ to, title, body }) {
    // eslint-disable-next-line no-console
    console.log(`[push:console] token=${to?.slice(0, 12)}... title="${title}" body="${body}"`);
    return { success: true, providerMessageId: `console-push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: "sent" };
  }
}

class FcmPushProvider {
  name = "fcm";
  async send() {
    throw Object.assign(new Error("FCM push provider is not configured — install firebase-admin and set PUSH_* env vars"), {
      statusCode: 501,
      code: "PROVIDER_NOT_CONFIGURED",
      errorClass: "permanent",
    });
  }
}

const PROVIDERS = { console: new ConsolePushProvider(), fcm: new FcmPushProvider() };

export function getPushProvider() {
  const name = process.env.PUSH_PROVIDER || "console";
  return PROVIDERS[name] || PROVIDERS.console;
}
