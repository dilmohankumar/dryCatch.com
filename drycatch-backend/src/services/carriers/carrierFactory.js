import { mockCarrierAdapter } from "./mockCarrierAdapter.js";
import { shiprocketAdapter } from "./shiprocketAdapter.js";

const CARRIERS = { mock: mockCarrierAdapter, shiprocket: shiprocketAdapter };

// Single knob: SHIPPING_CARRIER env var, default "mock" (the only carrier
// with real, working logic in this environment). shipmentService never
// branches on carrier name — it always talks to whatever this returns.
export function getCarrier(name = process.env.SHIPPING_CARRIER || "mock") {
  const carrier = CARRIERS[name];
  if (!carrier) throw Object.assign(new Error(`Unknown carrier: ${name}`), { statusCode: 500 });
  return carrier;
}
