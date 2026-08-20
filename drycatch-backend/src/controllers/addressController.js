import Address from "../models/Address.js";
import { logAuditEvent } from "../utils/auditLog.js";

// Explicit allowlist — never spread req.body into a query/update. Keeps
// mass-assignment impossible even if the model gains fields later.
const ALLOWED_FIELDS = [
  "type",
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "landmark",
  "city",
  "state",
  "postalCode",
  "country",
];

function pickAllowed(body) {
  const out = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

function validateRequired(data, { partial = false } = {}) {
  const required = ["fullName", "addressLine1", "city", "state", "postalCode"];
  const missing = required.filter((f) => !partial && !data[f]);
  return missing;
}

async function unsetDefaults(userId, fields) {
  const update = {};
  if (fields.includes("isDefaultShipping")) update.isDefaultShipping = false;
  if (fields.includes("isDefaultBilling")) update.isDefaultBilling = false;
  if (Object.keys(update).length) {
    await Address.updateMany({ user: userId }, { $set: update });
  }
}

// GET /addresses — only the caller's own addresses, ever.
export async function getAddresses(req, res) {
  const addresses = await Address.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ addresses });
}

// GET /addresses/:id
export async function getAddressById(req, res) {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });
  res.json({ address });
}

// POST /addresses
export async function createAddress(req, res) {
  const data = pickAllowed(req.body);
  const missing = validateRequired(data);
  if (missing.length) {
    return res.status(400).json({ message: `Missing required field(s): ${missing.join(", ")}` });
  }

  const existingCount = await Address.countDocuments({ user: req.user._id });
  // First address for the account becomes the default for both purposes.
  const isFirst = existingCount === 0;
  data.isDefaultShipping = isFirst || !!req.body.isDefaultShipping;
  data.isDefaultBilling = isFirst || !!req.body.isDefaultBilling;

  if (!isFirst) {
    const toUnset = [];
    if (data.isDefaultShipping) toUnset.push("isDefaultShipping");
    if (data.isDefaultBilling) toUnset.push("isDefaultBilling");
    if (toUnset.length) await unsetDefaults(req.user._id, toUnset);
  }

  const address = await Address.create({ ...data, user: req.user._id });
  logAuditEvent("ADDRESS_CREATED", req.user._id, { addressId: address._id });
  res.status(201).json({ address });
}

// PATCH /addresses/:id
export async function updateAddress(req, res) {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  const data = pickAllowed(req.body);
  const missing = validateRequired({ ...address.toObject(), ...data }, { partial: false });
  if (missing.length) {
    return res.status(400).json({ message: `Missing required field(s): ${missing.join(", ")}` });
  }

  Object.assign(address, data);

  const toUnset = [];
  if (req.body.isDefaultShipping) toUnset.push("isDefaultShipping");
  if (req.body.isDefaultBilling) toUnset.push("isDefaultBilling");
  if (toUnset.length) await unsetDefaults(req.user._id, toUnset);
  if (req.body.isDefaultShipping) address.isDefaultShipping = true;
  if (req.body.isDefaultBilling) address.isDefaultBilling = true;

  await address.save();
  logAuditEvent("ADDRESS_UPDATED", req.user._id, { addressId: address._id });
  res.json({ address });
}

// DELETE /addresses/:id
export async function deleteAddress(req, res) {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  const wasDefaultShipping = address.isDefaultShipping;
  const wasDefaultBilling = address.isDefaultBilling;
  await address.deleteOne();

  // Promote another address to default so there's always one if any remain.
  if (wasDefaultShipping || wasDefaultBilling) {
    const next = await Address.findOne({ user: req.user._id }).sort({ createdAt: 1 });
    if (next) {
      if (wasDefaultShipping) next.isDefaultShipping = true;
      if (wasDefaultBilling) next.isDefaultBilling = true;
      await next.save();
    }
  }

  logAuditEvent("ADDRESS_DELETED", req.user._id, { addressId: req.params.id });
  res.json({ message: "Address deleted" });
}

// PATCH /addresses/:id/default — body: { type: "shipping" | "billing" | "both" }
export async function setDefaultAddress(req, res) {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  const type = ["shipping", "billing", "both"].includes(req.body.type) ? req.body.type : "both";
  const toUnset = [];
  if (type === "shipping" || type === "both") toUnset.push("isDefaultShipping");
  if (type === "billing" || type === "both") toUnset.push("isDefaultBilling");
  await unsetDefaults(req.user._id, toUnset);

  if (type === "shipping" || type === "both") address.isDefaultShipping = true;
  if (type === "billing" || type === "both") address.isDefaultBilling = true;
  await address.save();

  res.json({ address });
}
