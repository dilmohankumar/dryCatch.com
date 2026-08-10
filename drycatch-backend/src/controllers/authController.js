import User from "../models/User.js";
import { generateOTP, otpExpiryDate, sendOTP } from "../utils/otp.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.js";

// POST /auth/signup — creates (or reuses) an unverified user and sends OTP
export async function signup(req, res) {
  const { firstName, lastName, email, phone, password, confirmPassword } = req.body;
  if (!firstName || !email || !password) {
    return res.status(400).json({ message: "firstName, email and password are required" });
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

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
    await user.save();
  } else {
    user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password,
      otp,
      otpExpires,
    });
  }

  await sendOTP(email, otp);
  res.status(201).json({ message: "OTP sent to your email", email: user.email });
}

// POST /auth/signup/verify-otp — { email, otp }
export async function verifySignupOTP(req, res) {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+otp +otpExpires");
  if (!user || !user.otp) {
    return res.status(400).json({ message: "No pending verification for this email" });
  }
  if (user.otp !== otp || user.otpExpires < new Date()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.json({ token, refreshToken, user: user.toSafeObject() });
}

// POST /auth/login — { email or phone, password }
export async function login(req, res) {
  const { email, phone, password } = req.body;
  const identifier = email || phone;
  if (!identifier || !password) {
    return res.status(400).json({ message: "Email/phone and password are required" });
  }

  const query = email ? { email: email.toLowerCase() } : { phone };
  const user = await User.findOne(query).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (!user.isVerified) {
    return res.status(403).json({ message: "Please verify your email before logging in" });
  }

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.json({ token, refreshToken, user: user.toSafeObject() });
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
  if (!newPassword) {
    return res.status(400).json({ message: "newPassword is required" });
  }

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful" });
}

// GET /auth/me
export async function getMe(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

// PUT /auth/profile
export async function updateProfile(req, res) {
  const { firstName, lastName, phone } = req.body;
  if (firstName !== undefined) req.user.firstName = firstName;
  if (lastName !== undefined) req.user.lastName = lastName;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ user: req.user.toSafeObject() });
}

// POST /auth/address
export async function addAddress(req, res) {
  req.user.addresses.push(req.body);
  await req.user.save();
  res.status(201).json({ addresses: req.user.addresses });
}

// POST /auth/logout — stateless JWT: client discards tokens
export async function logout(req, res) {
  res.json({ message: "Logged out" });
}

// POST /auth/refresh-token — { refreshToken }
export async function refreshToken(req, res) {
  const { refreshToken: token } = req.body;
  if (!token) return res.status(400).json({ message: "refreshToken is required" });

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User no longer exists" });

    res.json({ token: signAccessToken(user), refreshToken: signRefreshToken(user) });
  } catch {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
}
