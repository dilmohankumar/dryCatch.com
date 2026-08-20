// Provider abstraction (rule #11/#12): channels call `send()` on whatever
// this resolves to and never know which real service is behind it.
// "Honest stub" pattern used throughout this project (Stripe/Shiprocket in
// earlier phases) — ConsoleEmailProvider is the REAL, WORKING default (it
// genuinely delivers by logging, same as utils/otp.js's sendOTP), while
// SmtpEmailProvider is a structurally-identical stub that requires an SMTP
// library (`nodemailer`) to be installed and configured before it can
// actually send — it fails loudly and explicitly rather than pretending.
class ConsoleEmailProvider {
  name = "console";
  async send({ to, subject, body }) {
    // eslint-disable-next-line no-console
    console.log(`[email:console] to=${to} subject="${subject}"\n${body}`);
    return { success: true, providerMessageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: "sent" };
  }
}

class SmtpEmailProvider {
  name = "smtp";
  async send() {
    // Real SMTP delivery requires `nodemailer` (or an equivalent SDK) plus
    // SMTP_HOST/PORT/USER/PASS env vars — neither is installed/configured
    // in this project yet. Documented gap, not a silent fake success.
    throw Object.assign(new Error("SMTP email provider is not configured — install nodemailer and set SMTP_* env vars"), {
      statusCode: 501,
      code: "PROVIDER_NOT_CONFIGURED",
      errorClass: "permanent",
    });
  }
}

const PROVIDERS = { console: new ConsoleEmailProvider(), smtp: new SmtpEmailProvider() };

export function getEmailProvider() {
  const name = process.env.EMAIL_PROVIDER || "console";
  return PROVIDERS[name] || PROVIDERS.console;
}
