import * as inventoryService from "../services/inventoryService.js";
import Inventory from "../models/Inventory.js";
import { recordAdminAction } from "../services/admin/adminAuditService.js";

// GET /admin/inventory?search=&status=&page=&limit=
export async function getInventoryList(req, res) {
  const result = await inventoryService.listInventory(req.query);
  res.json({ success: true, data: result });
}

// GET /admin/inventory/:variantId
export async function getInventoryForVariant(req, res) {
  const availability = await inventoryService.getAvailability(req.params.variantId);
  res.json({ variantId: req.params.variantId, ...availability });
}

// POST /admin/inventory/adjust — { variantId, locationId?, delta, reason }
export async function postAdjustStock(req, res) {
  const { variantId, locationId, delta, reason } = req.body;
  const before = await Inventory.findOne({ variant: variantId, location: locationId }).lean();
  const inventory = await inventoryService.adjustStock({
    variantId,
    locationId,
    delta: Number(delta),
    reason,
    userId: req.user._id,
  });
  // Cross-cutting admin audit trail (Phase 14) alongside the existing
  // StockMovement ledger row (Phase 5) — the movement answers "what
  // happened to this SKU's stock," this answers "what did this admin do,"
  // searchable together with every other admin action.
  await recordAdminAction({
    actor: req.user._id, action: "INVENTORY_ADJUSTED", entityType: "Inventory", entityId: inventory._id,
    before, after: inventory.toObject ? inventory.toObject() : inventory, req,
  }).catch(() => {});
  res.json({ inventory });
}

// POST /admin/inventory/receive — { variantId, locationId?, quantity, reason }
export async function postReceiveStock(req, res) {
  const { variantId, locationId, quantity, reason } = req.body;
  const inventory = await inventoryService.receiveStock({
    variantId,
    locationId,
    quantity: Number(quantity),
    reason,
    userId: req.user._id,
  });
  res.json({ inventory });
}

// GET /admin/inventory/movements?variantId=&sku=&page=&limit=
export async function getMovements(req, res) {
  const result = await inventoryService.listMovements(req.query);
  res.json({ success: true, data: result });
}

// GET /products/:productId/variants/:variantId/availability — public,
// customer-safe: no on-hand/reserved counts, no warehouse info.
export async function getPublicAvailability(req, res) {
  const { available, status } = await inventoryService.getAvailability(req.params.variantId);
  res.json({ available: available > 0, status });
}
