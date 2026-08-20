// Same honest-stub pattern as emailProvider.js — console is the real
// working default, Twilio/MSG91/SNS are structural stubs pending an SDK +
// credentials, never silently faked as successful.
class ConsoleSmsProvider {
  name = "console";
  async send({ to, body }) {
    // eslint-disable-next-line no-console
    console.log(`[sms:console] to=${to} "${body}"`);
    return { success: true, providerMessageId: `console-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: "sent" };
  }
}

class TwilioSmsProvider {
  name = "twilio";
  async send() {
    throw Object.assign(new Error("Twilio SMS provider is not configured — install the twilio SDK and set SMS_* env vars"), {
      statusCode: 501,
      code: "PROVIDER_NOT_CONFIGURED",
      errorClass: "permanent",
    });
  }
}

const PROVIDERS = { console: new ConsoleSmsProvider(), twilio: new TwilioSmsProvider() };

export function getSmsProvider() {
  const name = process.env.SMS_PROVIDER || "console";
  return PROVIDERS[name] || PROVIDERS.console;
}
