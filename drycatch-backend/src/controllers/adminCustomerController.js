import * as adminCustomerService from "../services/admin/adminCustomerService.js";

export async function listCustomers(req, res) {
  res.json(await adminCustomerService.listCustomers(req.query));
}

export async function postBlock(req, res) {
  const customer = await adminCustomerService.blockCustomer(req.user._id, req.params.id, req.body.reason, req);
  res.json({ customer });
}

export async function postUnblock(req, res) {
  const customer = await adminCustomerService.unblockCustomer(req.user._id, req.params.id, req);
  res.json({ customer });
}
