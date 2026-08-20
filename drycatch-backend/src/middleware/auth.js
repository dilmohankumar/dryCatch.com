import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Reads the access token from the httpOnly cookie (browser clients) with a
// Bearer-header fallback (non-browser API clients, e.g. scripts/Postman).
export async function protect(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
  const token = req.cookies?.access_token || bearer;
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findById(decoded.id).select("+tokenVersion").populate("adminRole");
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    // Phase 18 fix: an access token signed before the last logout/
    // "logout other devices"/deactivation carries a stale tokenVersion —
    // reject it the same way a revoked refresh token already was, instead
    // of trusting it until its own expiry.
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session has been revoked, please log in again" });
    }
    if (user.status === "deactivated") {
      return res.status(403).json({ message: "This account has been deactivated" });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ message: "This account has been blocked. Contact support for assistance." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
}

// For routes that work for both guests and logged-in users (Cart) — sets
// req.user when a valid session exists, but never rejects the request when
// one doesn't. Deactivated accounts are still treated as "no session" here
// rather than erroring, since a guest-capable route shouldn't 403 someone
// who's simply not logged in.
export async function optionalAuth(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
  const token = req.cookies?.access_token || bearer;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findById(decoded.id).select("+tokenVersion").populate("adminRole");
    const versionMatches = user && (user.tokenVersion || 0) === (decoded.tokenVersion || 0);
    if (versionMatches && user.status === "active") req.user = user;
  } catch {
    // Invalid/expired token on a guest-capable route — proceed as a guest.
  }
  next();
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
