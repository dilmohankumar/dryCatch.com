# Security (Phase 18)

## Scope note

This project has no Docker/CI-CD, no distributed/multi-instance deployment,
no Redis, and no multi-tenant data model (confirmed by audit, consistent
with every earlier phase's documented single-tenant scope). Sections of a
generic "production SaaS security" checklist covering container hardening,
CI/CD pipeline scanning, WAF/CDN configuration, and distributed rate
limiting are **out of scope — there is no such infrastructure in this repo
to secure**, not silently skipped. Where the audit found a real, fixable
vulnerability in code that exists, it was fixed; where a section describes
infrastructure that doesn't exist, that's stated explicitly below rather
than fabricated.

## Audit method

Inspected: JWT/cookie/session implementation, `protect`/`optionalAuth`
middleware, RBAC (`utils/rbac.js`), every `findById(req.params...)` call
site across controllers for IDOR, login/signup/password-reset query
construction, CORS/helmet config, webhook signature verification (Phase 8
payments, Phase 10 shipping), CMS media validation (Phase 15), CSV export
sanitization (Phase 16/17), rate limiter coverage, `.env`/git history for
committed secrets, and the frontend for CSP/security headers.

## Findings & fixes

### HIGH — Access token revocation gap (fixed)

**Before**: `signAccessToken` embedded only `{id, role}`. Logout,
"logout other devices" (`revokeOtherSessions`), and account deactivation
all bump `user.tokenVersion` — but `protect`/`optionalAuth` never checked
it against the access token, only the refresh-token flow did. A
previously-issued access token (7-day default lifetime) kept working via
`Authorization: Bearer` or a copied cookie for up to 7 days after a user
"logged out everywhere," completely defeating that feature.

**Fix**: `tokenVersion` is now embedded in the access token
(`utils/tokens.js`) and checked on every request in both `protect` and
`optionalAuth` (`middleware/auth.js`) — a stale token is rejected with 401
immediately, not at its own expiry. Access token default lifetime was also
shortened 7d → 15m (compounding defense: even a token issued *before* a
version bump has a much smaller window before this check would have
caught it anyway — belt and suspenders). Cookie `maxAge` now matches the
JWT's own lifetime instead of a hardcoded, mismatched 7 days. The
frontend's `api.js` already transparently retries once via
`/auth/refresh-token` on a 401 (built in Phase 1), so this required zero
frontend changes.

**Verified**: live HTTP request — login → confirm cookie works on
`/auth/me` (200) → logout → replay the pre-logout cookie on `/auth/me` →
401. See verification section below.

### HIGH — NoSQL injection in `login()` (fixed)

**Before**: `const query = email ? { email: email.toLowerCase() } : { phone };`
— the `phone` branch passed the raw client-supplied value straight into a
Mongo query with no type check. `POST /auth/login {"phone": {"$ne": null}, "password": "x"}`
became `User.findOne({ phone: { $ne: null } })`, matching an arbitrary
user document instead of a specific phone number.

**Fix**: `authController.login` now rejects any request where
`email`/`phone`/`password` aren't strings, closing the hole structurally
rather than blocklisting operator shapes. Additionally added
`middleware/sanitizeInput.js` as global defense-in-depth — strips any
object key starting with `$` or containing `.` from `req.body`/
`req.query`/`req.params` recursively, so the same class of bug in a future
or overlooked endpoint doesn't silently become exploitable.

**Verified**: `curl` with `{"phone":{"$ne":null},...}` and
`{"email":{"$gt":""},...}` against a live server both now return
`400 {"message":"Invalid request"}` instead of executing as a query.

### MEDIUM — No centralized password policy (fixed)

**Before**: signup only checked `password` was truthy — a 1-character
password was accepted and bcrypt-hashed successfully.

**Fix**: `utils/passwordPolicy.js` — min 8 / max 128 characters (bcrypt
silently truncates beyond 72 bytes; the cap avoids a hashing-cost DoS from
huge inputs) plus a small common-password blocklist. Deliberately does
**not** require uppercase+lowercase+number+symbol combinations, per the
spec's own guidance against unnecessarily hostile rules — length is the
strongest, least user-hostile signal. Wired into `signup`, `resetPassword`,
and `changePassword`.

### MEDIUM — JWT algorithm not pinned (fixed)

`jwt.sign`/`jwt.verify` now explicitly pass `algorithm/algorithms: ["HS256"]`
everywhere a token is signed or verified (`utils/tokens.js`,
`middleware/auth.js`). Not previously exploitable given a symmetric secret
and the `jsonwebtoken` library's own defaults, but explicit pinning closes
the class of algorithm-confusion bugs entirely rather than relying on
library defaults staying safe forever.

### MEDIUM — Frontend shipped with zero CSP (fixed)

`dryCatch-frontend/index.html` had no CSP at all — no meta tag, no header
(it's a static Vite build with no Node server of its own in this repo, so
a `<meta>` tag is the only thing this repo itself can set). Added a
baseline restrictive policy: `default-src 'self'`, explicit allowlist for
Razorpay's checkout script/iframe, `style-src 'unsafe-inline'` (narrowly —
React's `style={{}}` prop needs it; scripts stay locked down), `object-src
'none'`. **Documented limitation**: `frame-ancestors` (clickjacking
protection) cannot be set via `<meta>` — browsers ignore it there — so
actual clickjacking protection for this SPA must be configured at
whatever hosting/CDN/reverse-proxy serves the production build.

### INFO — Pre-existing, not a regression

- CMS media "upload" (Phase 15) is metadata-registration only — no real
  file-upload byte pipeline exists, so file-signature/malware-scanning
  sections of a generic security checklist don't apply to real uploaded
  bytes (there are none). Already documented in `docs/cms.md`.
- No secrets found in git history (`.env` never tracked — confirmed via
  `git log --all --diff-filter=A --name-only | grep .env`, zero results).

### Confirmed sound (no new issues)

RBAC/`requirePermission` layering (Phases 14–17), IDOR ownership checks on
orders/shipments/reviews/addresses (each already gated by
`String(resource.user) === String(req.user._id) || req.user.role === "admin"`),
webhook HMAC signature verification (Phase 8 payments, Phase 10 shipping)
with idempotent `WebhookEvent`/`ShipmentEvent` dedup, CSV
formula-injection sanitization (Phase 17's `utils/csvExport.js`), explicit
field-allowlisting against mass assignment (e.g. `updateProfile` only
reads `firstName`/`lastName`/`phone` off `req.body`, never `role`/
`tokenVersion`/etc.), cookie `httpOnly` + `sameSite=lax` + `secure` in
production, rate limiting on auth/OTP/coupon/analytics-ingestion endpoints.

## Threat model (brief)

| Actor | Primary risk | Existing/added mitigation |
|---|---|---|
| Anonymous attacker | Credential stuffing, NoSQL injection, enumeration | `authLimiter` (20/15min), generic password-reset response ("if an account exists..."), login now type-checks identifiers |
| Authenticated customer | IDOR against other customers' orders/addresses/reviews | Ownership checks at every `findById` call site (verified in this audit) |
| Compromised/leaked access token | Session persists past logout | Fixed this phase — `tokenVersion` check + 15m lifetime |
| Malicious admin input | Stored XSS via CMS/reviews | Phase 12/15 sanitization (`sanitizePlainText`, block-registry field allowlisting) |
| Webhook spoofing | Fake payment/shipping events | HMAC signature verification, rejects if secret unconfigured (fail-closed) |

## Verification performed

- Full backend `node --check` across every file — clean.
- Boot test — connects and listens with no errors.
- Scratch test (10 checks, removed after passing): tokenVersion embedding,
  stale-token detection, fresh-token-after-revocation match, HS256 pinning,
  15-minute default lifetime, password policy accept/reject cases,
  `sanitizeInput` stripping `$`-keys and dotted keys.
- **Live HTTP verification** (not just unit-level): real login → protected
  route (200) → logout → replay pre-logout cookie → **401**, proving the
  actual vulnerability is closed through the real request stack.
- Live HTTP verification of the NoSQL injection fix: both
  `{"phone":{"$ne":null}}` and `{"email":{"$gt":""}}` payloads against
  `/auth/login` now return `400`, not a query match or a crash.
- Frontend `npm run build` — clean, CSP meta tag present in build output.

## Accepted risks / technical debt

- MFA/TOTP (spec §13–14) — **not implemented**. Would require a new
  dependency (e.g. `otplib`), a recovery-code model, and admin-facing UI;
  a genuinely new feature, not a fix to existing code, and out of scope
  for an audit-and-remediate pass. Flagged as the top candidate for a
  dedicated follow-up phase given admin accounts are the highest-value
  target here.
- Refresh-token-reuse-detection-as-theft-signal (spec §16–17) — partial:
  reuse of a revoked refresh token is already rejected (tokenVersion
  mismatch → 401 + cookies cleared), but there's no automatic "revoke the
  whole session family and alert" response beyond that single rejection.
- Per-session/device listing (spec §19) — not implemented; this project's
  JWTs are stateless with account-wide revocation (`tokenVersion`), not a
  per-device session table. Building real session listing would mean
  introducing a session-record collection, a real architecture change,
  not a security patch.
- Security event/observability metrics (spec §119–121, 135–137) — this
  project already has `logAuditEvent` (Phase 1) covering login/logout/
  password events, but no dedicated security-metrics dashboard or
  automated suspicious-activity thresholding exists. Flagged as
  Phase-19-candidate scope, not silently implemented as a stub.
- Distributed rate limiting, WAF/CDN, container/CI hardening — N/A, no
  such infrastructure exists in this repo (see Scope note above).

## Final severity count

CRITICAL: 0 · HIGH: 2 (both fixed) · MEDIUM: 4 (all fixed) · LOW: 0 ·
ACCEPTED RISKS: 4 (documented above, genuinely new features/infrastructure,
not remediations of existing code) · INFO: 2 (pre-existing, no regression)
