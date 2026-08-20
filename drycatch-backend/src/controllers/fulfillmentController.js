import * as fulfillmentService from "../services/fulfillmentService.js";

// All admin-only — a warehouse operator role doesn't exist in this
// project's RBAC yet (only customer/admin — same honest limitation noted
// in Phase 9), so these sit behind the existing adminOnly middleware.
export async function postCreateFulfillment(req, res) {
  const { orderId, warehouseId, items } = req.body;
  const fulfillment = await fulfillmentService.createFulfillment({ orderId, warehouseId, items });
  res.status(201).json({ fulfillment });
}

export async function getFulfillment(req, res) {
  const result = await fulfillmentService.getFulfillment(req.params.id);
  res.json(result);
}

export async function listFulfillments(req, res) {
  const { status, warehouseId, page, limit } = req.query;
  const result = await fulfillmentService.listFulfillments({
    status, warehouseId, page: Number(page) || 1, limit: Number(limit) || 50,
  });
  res.json(result);
}

export async function postAllocate(req, res) {
  const fulfillment = await fulfillmentService.allocate(req.params.id, req.user._id);
  res.json({ fulfillment });
}

export async function postStartPicking(req, res) {
  const fulfillment = await fulfillmentService.startPicking(req.params.id, req.user._id);
  res.json({ fulfillment });
}

export async function postStartPacking(req, res) {
  const fulfillment = await fulfillmentService.startPacking(req.params.id, req.user._id);
  res.json({ fulfillment });
}

export async function postMarkReadyToShip(req, res) {
  const fulfillment = await fulfillmentService.markReadyToShip(req.params.id, req.user._id);
  res.json({ fulfillment });
}
