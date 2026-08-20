import { razorpayProvider } from "./razorpayProvider.js";
import { stripeProvider } from "./stripeProvider.js";

const PROVIDERS = { razorpay: razorpayProvider, stripe: stripeProvider };

// Single knob: PAYMENT_PROVIDER env var, defaulting to razorpay (the only
// provider actually configured/credentialed in this project right now).
// Business logic (paymentService) never branches on provider name — it
// always talks to whatever `getProvider()` returns.
export function getProvider(name = process.env.PAYMENT_PROVIDER || "razorpay") {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw Object.assign(new Error(`Unknown payment provider: ${name}`), { statusCode: 500 });
  }
  return provider;
}
