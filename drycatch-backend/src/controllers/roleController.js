import Role from "../models/Role.js";
import { ALL_PERMISSIONS, PERMISSIONS } from "../utils/rbac.js";
import { recordAdminAction } from "../services/admin/adminAuditService.js";

export async function listRoles(req, res) {
  res.json({ roles: await Role.find().sort({ name: 1 }), permissionGroups: PERMISSIONS, allPermissions: ALL_PERMISSIONS });
}

export async function createRole(req, res) {
  const { name, description, permissions } = req.body;
  const role = await Role.create({ name, description, permissions });
  await recordAdminAction({ actor: req.user._id, action: "ROLE_CREATED", entityType: "Role", entityId: role._id, after: role.toObject(), req }).catch(() => {});
  res.status(201).json({ role });
}

export async function updateRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  if (role.isSystem) return res.status(403).json({ message: "System roles cannot be modified", code: "SYSTEM_ROLE_PROTECTED" });

  const before = role.toObject();
  const { description, permissions } = req.body;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = permissions;
  await role.save();

  await recordAdminAction({ actor: req.user._id, action: "ROLE_UPDATED", entityType: "Role", entityId: role._id, before, after: role.toObject(), req }).catch(() => {});
  res.json({ role });
}

export async function deleteRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) return res.status(404).json({ message: "Role not found" });
  if (role.isSystem) return res.status(403).json({ message: "System roles cannot be deleted", code: "SYSTEM_ROLE_PROTECTED" });
  await role.deleteOne();
  await recordAdminAction({ actor: req.user._id, action: "ROLE_DELETED", entityType: "Role", entityId: req.params.id, before: role.toObject(), req }).catch(() => {});
  res.json({ ok: true });
}
