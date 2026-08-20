import User from "../models/User.js";
import Role from "../models/Role.js";
import { SUPER_ADMIN } from "./rbac.js";

// The bootstrapping problem every invite-only admin system has: admins can
// only be created by an existing admin inviting them (adminUserService.js)
// — so a brand-new deployment with zero admin users has no one able to
// call that API at all. This creates exactly one SUPER_ADMIN, only when
// NO admin user exists yet and only when ADMIN_BOOTSTRAP_EMAIL/
// ADMIN_BOOTSTRAP_PASSWORD are set — idempotent (a second boot with an
// admin already present is a no-op) and never overwrites an existing
// account's password.
export async function seedSuperAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const anyAdminExists = await User.exists({ role: "admin" });
  if (anyAdminExists) return;

  const superAdminRole = await Role.findOne({ name: SUPER_ADMIN });
  if (!superAdminRole) return; // seedRoles() must run first

  await User.create({
    firstName: "Super", lastName: "Admin", email: email.toLowerCase(), password,
    role: "admin", adminRole: superAdminRole._id, isVerified: true, status: "active",
  });
  console.log(`[BOOTSTRAP] Created initial Super Admin: ${email}`);
}
