import * as adminUserService from "../services/admin/adminUserService.js";

export async function postInvite(req, res) {
  const invite = await adminUserService.inviteAdmin(req.user._id, req.body, req);
  res.status(201).json({ invite: { id: invite._id, email: invite.email, expiresAt: invite.expiresAt } });
}

// POST /admin/accept-invite — { token, firstName, lastName, password } — no auth, the token IS the credential.
export async function postAcceptInvite(req, res) {
  const { token, firstName, lastName, password } = req.body;
  const user = await adminUserService.acceptInvite(token, { firstName, lastName, password });
  res.status(201).json({ user: { id: user._id, email: user.email } });
}

export async function listAdminUsers(req, res) {
  res.json(await adminUserService.listAdminUsers(req.query));
}

export async function patchAdminRole(req, res) {
  const user = await adminUserService.updateAdminRole(req.user._id, req.params.id, req.body.roleId, req);
  res.json({ user });
}

export async function postDeactivate(req, res) {
  const user = await adminUserService.deactivateAdmin(req.user._id, req.params.id, req);
  res.json({ user });
}
