import User from "../../models/User.js";
import { recordAdminAction } from "./adminAuditService.js";

function fail(message, code, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode, code });
}

// Admin-initiated account suspension (rule #47) — distinct from the
// customer's own self-service "deactivated" state (Phase 2). Blocking
// immediately prevents login (see middleware/auth.js) but never deletes
// the account or its order history.
export async function blockCustomer(actorId, customerId, reason, req) {
  const customer = await User.findOne({ _id: customerId, role: "customer" });
  if (!customer) fail("Customer not found", "USER_NOT_FOUND", 404);

  customer.status = "blocked";
  customer.blockedAt = new Date();
  customer.blockedBy = actorId;
  customer.blockReason = reason;
  await customer.save();

  await recordAdminAction({
    actor: actorId, action: "CUSTOMER_BLOCKED", entityType: "User", entityId: customerId,
    after: { reason }, req,
  }).catch(() => {});
  return customer;
}

export async function unblockCustomer(actorId, customerId, req) {
  const customer = await User.findOneAndUpdate(
    { _id: customerId, role: "customer" },
    { status: "active", $unset: { blockedAt: "", blockedBy: "", blockReason: "" } },
    { new: true }
  );
  if (!customer) fail("Customer not found", "USER_NOT_FOUND", 404);

  await recordAdminAction({ actor: actorId, action: "CUSTOMER_UNBLOCKED", entityType: "User", entityId: customerId, req }).catch(() => {});
  return customer;
}

export async function listCustomers({ search, status, page = 1, limit = 50 } = {}) {
  const filter = { role: "customer" };
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: "i" } },
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
    ];
  }
  const [customers, total] = await Promise.all([
    User.find(filter).select("firstName lastName email phone status createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    User.countDocuments(filter),
  ]);
  return { customers, page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) };
}

export { fail };
