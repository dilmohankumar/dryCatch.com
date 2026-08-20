import Inventory from "../../models/Inventory.js";
import ProductVariant from "../../models/ProductVariant.js";
import { cached } from "../../utils/analyticsCache.js";

// Inventory analytics are live gauges (current stock state), not a
// day-bucketed history — a direct, indexed query on Inventory
// (`inventorySchema.index({status:1})`) rather than a duplicate daily
// aggregate table, same reasoning as orderAnalyticsService.js. "Stock
// value" uses `ProductVariant.price` (rule #28: never invent COGS —
// there is no separate cost-price field in this project, so stock value
// here is at selling price, explicitly labeled as such, not "profit").
export async function getInventoryAnalytics() {
  return cached("inventory:overview", 30_000, async () => {
    const rows = await Inventory.aggregate([
      { $match: { status: "active" } },
      { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
      { $unwind: "$variant" },
      {
        $project: {
          available: { $subtract: ["$quantityOnHand", "$quantityReserved"] },
          quantityOnHand: 1,
          reorderLevel: 1,
          price: "$variant.price",
        },
      },
    ]);

    let unitsInStock = 0;
    let stockValueAtSellingPrice = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const row of rows) {
      unitsInStock += Math.max(row.quantityOnHand, 0);
      stockValueAtSellingPrice += Math.max(row.quantityOnHand, 0) * (row.price || 0);
      if (row.available <= 0) outOfStockCount++;
      else if (row.available <= (row.reorderLevel ?? 10)) lowStockCount++;
    }

    return {
      summary: {
        unitsInStock,
        stockValueAtSellingPrice, // NOT profit/COGS — labeled explicitly (rule #28/#121/#122)
        lowStockCount,
        outOfStockCount,
        totalActiveVariants: rows.length,
      },
      // Inventory turnover (rule #27/#28) intentionally NOT calculated —
      // this project has no cost-of-goods-sold or inventory-valuation data,
      // and rule #28 explicitly says never invent it. Returned as null with
      // a reason rather than a fabricated number.
      turnover: { value: null, reason: "No cost-of-goods-sold data exists in this project — turnover requires COGS / average inventory value." },
    };
  });
}

export async function getLowStockAndOutOfStock({ limit = 50 } = {}) {
  const cap = Math.min(Number(limit) || 50, 200);
  const rows = await Inventory.aggregate([
    { $match: { status: "active" } },
    { $addFields: { available: { $subtract: ["$quantityOnHand", "$quantityReserved"] } } },
    { $match: { $expr: { $lte: ["$available", "$reorderLevel"] } } },
    { $sort: { available: 1 } },
    { $limit: cap },
    { $lookup: { from: "productvariants", localField: "variant", foreignField: "_id", as: "variant" } },
    { $unwind: "$variant" },
    { $lookup: { from: "products", localField: "variant.product", foreignField: "_id", as: "product" } },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    { $project: { productName: "$product.name", sku: "$variant.sku", available: 1, quantityOnHand: 1, reorderLevel: 1 } },
  ]);
  return { data: rows };
}
