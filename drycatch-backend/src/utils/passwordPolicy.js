// Centralized password policy (Phase 18, rule #10) — one place, checked
// everywhere a password is set (signup, reset, change). Deliberately does
// NOT require arbitrary uppercase+lowercase+number+symbol combinations —
// length is the strongest, least user-hostile signal of strength, per the
// spec's explicit guidance against "unnecessarily hostile password rules."
const MIN_LENGTH = 8;
const MAX_LENGTH = 128; // bcrypt silently truncates beyond 72 bytes; cap well above that but bounded to avoid a hashing-cost DoS from multi-KB inputs

// A short, practical blocklist — not exhaustive breach-database checking
// (that would require a third-party service this project doesn't
// integrate), but enough to reject the handful of passwords that show up
// in nearly every credential-stuffing wordlist.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "12345678", "123456789", "qwertyuiop",
  "letmein11", "welcome11", "admin1234", "iloveyou1", "password123",
]);

export function validatePassword(password) {
  if (typeof password !== "string") return "Password is required";
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (password.length > MAX_LENGTH) return `Password must be at most ${MAX_LENGTH} characters`;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "This password is too common — please choose a stronger one";
  return null; // valid
}
