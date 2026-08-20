import Order from "../../models/Order.js";
import DailySalesMetric from "../../models/DailySalesMetric.js";
import { dateKeyToUtcRange } from "../../utils/businessDate.js";

// Detects drift between the transactional source of truth (Order) and the
// derived aggregate (DailySalesMetric) for a given day (rule #71). Analytics
// is allowed to be eventually consistent, but drift should never go
// unnoticed — this is what an admin (or a future scheduled job) runs to
// find out if it has.
export async function reconcileDay(dateKey) {
  const { start, end } = dateKeyToUtcRange(dateKey);

  const [orderAgg] = await Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        grossSales: { $sum: "$subtotal" },
        discountAmount: { $sum: "$discountAmount" },
        ordersCount: { $sum: 1 },
        unitsSold: { $sum: { $sum: "$items.quantity" } },
      },
    },
  ]);
  const transactional = orderAgg || { grossSales: 0, discountAmount: 0, ordersCount: 0, unitsSold: 0 };

  const aggregate = (await DailySalesMetric.findOne({ dateKey })) || { grossSales: 0, discountAmount: 0, ordersCount: 0, unitsSold: 0 };

  const fields = ["grossSales", "discountAmount", "ordersCount", "unitsSold"];
  const differences = {};
  let hasDrift = false;
  for (const field of fields) {
    const diff = (aggregate[field] || 0) - (transactional[field] || 0);
    differences[field] = diff;
    if (Math.abs(diff) > 0.01) hasDrift = true;
  }

  return { dateKey, transactional, aggregate: { grossSales: aggregate.grossSales, discountAmount: aggregate.discountAmount, ordersCount: aggregate.ordersCount, unitsSold: aggregate.unitsSold }, differences, hasDrift };
}

export async function reconcileRange(dateKeys) {
  const results = [];
  for (const dateKey of dateKeys) results.push(await reconcileDay(dateKey));
  return { results, driftDays: results.filter((r) => r.hasDrift).map((r) => r.dateKey) };
}
