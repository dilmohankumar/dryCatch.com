import OrderCounter from "../models/OrderCounter.js";

// DC-<year>-<6-digit sequence>, e.g. DC-2026-000123. The atomic
// findOneAndUpdate/$inc is what makes this collision-safe under concurrent
// order creation — two simultaneous callers get two distinct, sequential
// numbers, never the same one.
export async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const counter = await OrderCounter.findOneAndUpdate(
    { _id: `order_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `DC-${year}-${String(counter.seq).padStart(6, "0")}`;
}
