import jwt from "jsonwebtoken";

// tokenVersion is embedded here (Phase 18 security fix) so that logout /
// "logout other devices" / account deactivation — which all bump
// user.tokenVersion — actually invalidate an already-issued ACCESS token,
// not just the refresh token. Previously only the refresh token embedded
// tokenVersion, so a stolen/leaked access token kept working via the
// Authorization header (or a copied cookie) for up to its own 7-day
// lifetime even after the user "logged out everywhere."
export function signAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m", algorithm: "HS256" }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d", algorithm: "HS256" }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// httpOnly cookies (not localStorage) so tokens aren't reachable from JS/XSS.
// `secure` is only forced in production so local http dev still works.
function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

// Cookie maxAge matches the JWT's own expiresIn (previously hardcoded to
// 7 days regardless of the token's actual lifetime) — the frontend's
// api.js already transparently retries once via /auth/refresh-token on a
// 401, so a short-lived access token cookie costs nothing in UX while
// shrinking a leaked-token's usable window from days to minutes.
export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie("access_token", accessToken, cookieOptions(15 * MINUTE_MS));
  res.cookie("refresh_token", refreshToken, cookieOptions(30 * DAY_MS));
}

export function clearAuthCookies(res) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
}
