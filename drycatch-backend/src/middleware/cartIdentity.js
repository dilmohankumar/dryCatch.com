import crypto from "crypto";

const GUEST_COOKIE = "guest_cart_id";
const GUEST_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Must run after optionalAuth. Resolves req.cartIdentity to exactly one of
// { userId } (logged in) or { guestId } (anonymous) — never both — and
// issues a guest id cookie on first visit if there's no session. The guest
// id is a random UUID, not a sequential/guessable id, so one guest can't
// enumerate another's cart.
export function identifyCart(req, res, next) {
  if (req.user) {
    req.cartIdentity = { userId: req.user._id };
    return next();
  }

  let guestId = req.cookies?.[GUEST_COOKIE];
  if (!guestId) {
    guestId = crypto.randomUUID();
    res.cookie(GUEST_COOKIE, guestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE_MS,
    });
  }
  req.cartIdentity = { guestId };
  next();
}

export function clearGuestCartCookie(res) {
  res.clearCookie(GUEST_COOKIE, { path: "/" });
}

export { GUEST_COOKIE };
