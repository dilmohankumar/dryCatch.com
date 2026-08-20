import User from "../models/User.js";
import { generateOTP, otpExpiryDate, sendOTP } from "../utils/otp.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "../utils/tokens.js";
import { logAuditEvent } from "../utils/auditLog.js";
import { validatePassword } from "../utils/passwordPolicy.js";
import * as referralService from "../services/growth/referralService.js";
import { mergeGuestCartIntoUser } from "../services/cartService.js";
import { clearGuestCartCookie, GUEST_COOKIE } from "../middleware/cartIdentity.js";
import * as eventBus from "../services/notifications/eventBus.js";
import { EVENT_TYPES } from "../utils/notificationEvents.js";

// POST /auth/signup — creates (or reuses) an unverified user and sends OTP
export async function signup(req, res) {
  const { firstName, lastName, email, phone, password, confirmPassword, referralCode } = req.body;
  if (!firstName || !email || !password) {
    return res.status(400).json({ message: "firstName, email and password are required" });
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });

  let user = await User.findOne({ email: email.toLowerCase() });
  if (user?.isVerified) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const otp = generateOTP();
  const otpExpires = otpExpiryDate();

  if (user) {
    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;
    user.password = password;
    user.otp = otp;
    user.otpExpires = otpExpires;
    if (referralCode) user.pendingReferralCode = referralCode;
    await user.save();
  } else {
    user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password,
      pendingReferralCode: referralCode || undefined,
      otp,
      otpExpires,
    });
    await eventBus.publish(EVENT_TYPES.USER_REGISTERED, { userId: String(user._id) }, { source: "auth" });
  }

  await sendOTP(email, otp);
  await eventBus.publish(EVENT_TYPES.EMAIL_VERIFICATION_REQUIRED, { userId: String(user._id) }, { source: "auth" });
  res.status(201).json({ message: "OTP sent to your email", email: user.email });
}

// POST /auth/signup/verify-otp — { email, otp }
export async function verifySignupOTP(req, res) {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+otp +otpExpires +tokenVersion +pendingReferralCode");
  if (!user || !user.otp) {
    return res.status(400).json({ message: "No pending verification for this email" });
  }
  if (user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  const pendingReferralCode = user.pendingReferralCode;
  user.pendingReferralCode = undefined;
  await user.save();

  // Phase 24 — attribution happens on VERIFIED signup, not raw signup, so
  // an account that never completes email verification never counts as a
  // referral (rule #27's "qualifying action" starts with a real account).
  if (pendingReferralCode) {
    const signupIp = req.ip;
    await referralService.attributeSignup(user._id, pendingReferralCode, signupIp).catch(() => {});
  }

  setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) });
  await mergeGuestCartIntoUser(req.cookies?.[GUEST_COOKIE], user._id).catch(() => {});
  clearGuestCartCookie(res);
  res.json({ user: user.toSafeObject() });
}

// POST /auth/login — { email or phone, password }
export async function login(req, res) {
  const { email, phone, password } = req.body;
  // Phase 18 security fix: both fields MUST be primitives before they ever
  // reach a Mongo query. The `phone` branch previously passed the raw
  // client value straight through — `{ phone: { "$ne": null } }` would
  // silently become a query operator (`User.findOne({ phone: { $ne: null } })`),
  // matching an arbitrary user instead of a specific one. Rejecting
  // non-string identifiers/passwords outright closes this off structurally
  // rather than trying to blocklist operator-shaped values.
  if ((email !== undefined && typeof email !== "string") || (phone !== undefined && typeof phone !== "string") || (password !== undefined && typeof password !== "string")) {
    return res.status(400).json({ message: "Invalid request" });
  }
  const identifier = email || phone;
  if (!identifier || !password) {
    return res.status(400).json({ message: "Email/phone and password are required" });
  }

  const query = email ? { email: email.toLowerCase() } : { phone };
  const user = await User.findOne(query).select("+password +tokenVersion");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (!user.isVerified) {
    return res.status(403).json({ message: "Please verify your email before logging in" });
  }
  if (user.status === "deactivated") {
    return res.status(403).json({ message: "This account has been deactivated" });
  }
  if (user.status === "blocked") {
    return res.status(403).json({ message: "This account has been blocked. Contact support for assistance." });
  }

  setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) });
  await mergeGuestCartIntoUser(req.cookies?.[GUEST_COOKIE], user._id).catch(() => {});
  clearGuestCartCookie(res);
  res.json({ user: user.toSafeObject() });
}

// POST /auth/password-reset/request — { email }
export async function requestPasswordReset(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user) {
    // Do not reveal whether the account exists.
    return res.json({ message: "If that account exists, an OTP has been sent" });
  }

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = otpExpiryDate();
  await user.save();
  await sendOTP(email, otp);
  await eventBus.publish(EVENT_TYPES.PASSWORD_RESET_REQUESTED, { userId: String(user._id) }, { source: "auth" });

  res.json({ message: "If that account exists, an OTP has been sent" });
}

// POST /auth/password-reset/verify-otp — { email, otp, newPassword }
export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+otp +otpExpires");
  if (!user || !user.otp) {
    return res.status(400).json({ message: "No pending reset for this email" });
  }
  if (user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  await eventBus.publish(EVENT_TYPES.PASSWORD_CHANGED, { userId: String(user._id) }, { source: "auth" });

  res.json({ message: "Password reset successful" });
}

// GET /auth/me
export async function getMe(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

// PUT /auth/profile
// Explicit field allowlist — req.body is never spread/assigned wholesale,
// so a client can't smuggle role/status/isVerified/tokenVersion etc. through
// this endpoint (mass-assignment protection).
export async function updateProfile(req, res) {
  const { firstName, lastName, phone } = req.body;
  if (firstName !== undefined) req.user.firstName = firstName;
  if (lastName !== undefined) req.user.lastName = lastName;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  logAuditEvent("PROFILE_UPDATED", req.user._id, { fields: Object.keys(req.body).filter((f) => ["firstName", "lastName", "phone"].includes(f)) });
  res.json({ user: req.user.toSafeObject() });
}

// POST /auth/deactivate — { password } — reversible, self-service account
// deactivation. Does NOT delete anything: keeps the User document (and its
// orders/reviews) intact, just blocks login/API access (see middleware/auth.js)
// until an admin reactivation flow exists. Revokes all sessions immediately.
export async function deactivateAccount(req, res) {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: "password is required" });

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Incorrect password" });
  }

  user.status = "deactivated";
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  logAuditEvent("ACCOUNT_DEACTIVATED", user._id);
  clearAuthCookies(res);
  res.json({ message: "Account deactivated" });
}

// POST /auth/sessions/revoke-others — bumps tokenVersion (invalidating every
// refresh token issued before now, i.e. every other logged-in device/tab),
// then immediately issues a fresh pair for the CURRENT request so this
// session stays logged in. There's no per-device session record yet (JWTs
// are stateless) — this is account-wide revocation, not a session list.
export async function revokeOtherSessions(req, res) {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  setAuthCookies(res, {
    accessToken: signAccessToken(req.user),
    refreshToken: signRefreshToken(req.user),
  });
  logAuditEvent("SESSIONS_REVOKED", req.user._id, { scope: "others" });
  res.json({ message: "All other sessions have been logged out" });
}

// PUT /auth/change-password — { currentPassword, newPassword }
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();
  logAuditEvent("PASSWORD_CHANGED", req.user._id);
  await eventBus.publish(EVENT_TYPES.PASSWORD_CHANGED, { userId: String(user._id) }, { source: "auth" });
  res.json({ message: "Password updated successfully" });
}

// POST /auth/logout — bumps tokenVersion so the refresh token this session
// holds (and any other still-live refresh token for this user) is rejected
// on its next use, then clears the auth cookies.
export async function logout(req, res) {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  clearAuthCookies(res);
  res.json({ message: "Logged out" });
}

// POST /auth/refresh-token — reads the refresh token from the httpOnly cookie
export async function refreshToken(req, res) {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select("+tokenVersion");
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Refresh token has been revoked" });
    }

    setAuthCookies(res, { accessToken: signAccessToken(user), refreshToken: signRefreshToken(user) });
    res.json({ user: user.toSafeObject() });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}
