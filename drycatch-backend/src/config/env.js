// Centralized environment validation (Phase 21, rule #8/#40) — fails loudly
// at boot if critical configuration is missing, rather than starting with
// `undefined` secrets that silently break auth/payments/webhooks later.
// This does NOT migrate every existing `process.env.X` read across the
// codebase (22 files reference it directly) — that would be a large,
// unjustified rewrite of working code for a single-instance project with
// no deployment target yet (change-minimization principle). What this DOES
// do is the actual safety-critical piece: refuse to boot at all if a
// required secret/URL is missing or looks like a placeholder, and give
// new code one place to read validated, typed config from.

const REQUIRED_IN_ALL_ENVS = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET"];

// Values from .env.example that must never reach a real deployment —
// catches "I copied .env.example and forgot to fill it in" before it
// becomes a production incident (rule #55 — "production must not use...
// weak secrets").
const PLACEHOLDER_VALUES = new Set([
  "change_this_secret",
  "change_this_refresh_secret",
  "your_razorpay_key_secret",
  "your_webhook_secret",
]);

export function validateEnv({ env = process.env, exitOnFailure = true } = {}) {
  const errors = [];

  for (const key of REQUIRED_IN_ALL_ENVS) {
    if (!env[key]) errors.push(`Missing required environment variable: ${key}`);
    else if (PLACEHOLDER_VALUES.has(env[key])) errors.push(`${key} is still set to its .env.example placeholder value — set a real secret`);
  }

  if (env.NODE_ENV === "production") {
    if (!env.CLIENT_URL || env.CLIENT_URL.includes("localhost")) {
      errors.push("CLIENT_URL must be set to the real production frontend origin, not localhost, when NODE_ENV=production");
    }
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      errors.push("JWT_SECRET is too short for production use (< 32 characters)");
    }
    if (env.PAYMENT_PROVIDER === "razorpay" && (!env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET)) {
      errors.push("RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required in production when PAYMENT_PROVIDER=razorpay");
    }
  }

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error("\n[CONFIG ERROR] Refusing to start — invalid environment configuration:\n" + errors.map((e) => `  - ${e}`).join("\n") + "\n");
    if (exitOnFailure) process.exit(1);
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
}

// A small, typed config surface for new code — existing `process.env.X`
// call sites elsewhere are left as-is (see comment above), this is
// additive, not a forced migration.
export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
};
