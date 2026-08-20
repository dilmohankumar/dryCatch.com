import Warehouse from "../models/Warehouse.js";

// Minimal CRUD (rule #27: "do not create a complex warehouse system unless
// required") — admin-only, no customer-facing surface at all.
export async function listWarehouses(req, res) {
  const warehouses = await Warehouse.find().sort({ name: 1 });
  res.json({ warehouses });
}

export async function createWarehouse(req, res) {
  const { name, code, address } = req.body;
  const warehouse = await Warehouse.create({ name, code, address });
  res.status(201).json({ warehouse });
}
