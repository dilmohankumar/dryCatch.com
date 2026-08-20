// WhatsApp readiness only (rule #10/#158 "WhatsApp abstraction is ready")
// — no real WhatsApp Business API integration exists; console stands in
// so the channel contract can be exercised end-to-end without a live
// account, exactly like every other provider here.
class ConsoleWhatsAppProvider {
  name = "console";
  async send({ to, body }) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:console] to=${to} "${body}"`);
    return { success: true, providerMessageId: `console-wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: "sent" };
  }
}

class MetaWhatsAppProvider {
  name = "meta";
  async send() {
    throw Object.assign(new Error("WhatsApp Business API provider is not configured"), {
      statusCode: 501,
      code: "PROVIDER_NOT_CONFIGURED",
      errorClass: "permanent",
    });
  }
}

const PROVIDERS = { console: new ConsoleWhatsAppProvider(), meta: new MetaWhatsAppProvider() };

export function getWhatsAppProvider() {
  const name = process.env.WHATSAPP_PROVIDER || "console";
  return PROVIDERS[name] || PROVIDERS.console;
}
