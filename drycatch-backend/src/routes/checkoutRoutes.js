import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth.js";
import {
  postCreateCheckout,
  getCheckout,
  postValidate,
  patchShippingAddress,
  patchBillingAddress,
  getShippingMethods,
  patchShippingMethod,
  postCoupon,
  deleteCoupon,
  postPlaceOrder,
} from "../controllers/checkoutController.js";

// Checkout requires a logged-in account (it needs a saved-address-capable,
// order-owning identity) — unlike Cart, there's no guest checkout in this
// pass. Every route derives ownership from req.user, never from the URL
// or body (see checkoutService's requireOwnedCheckout).
const router = Router();
router.use(protect);

// Coupon codes are an enumeration/brute-force target (rule #70/#71) —
// throttled tighter than the blanket apiLimiter in app.js, same pattern as
// authLimiter for auth/OTP endpoints.
const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many coupon attempts, please try again later" },
});

router.post("/", postCreateCheckout);
router.get("/:id", getCheckout);
router.post("/:id/validate", postValidate);
router.patch("/:id/shipping-address", patchShippingAddress);
router.patch("/:id/billing-address", patchBillingAddress);
router.get("/:id/shipping-methods", getShippingMethods);
router.patch("/:id/shipping-method", patchShippingMethod);
router.post("/:id/coupon", couponLimiter, postCoupon);
router.delete("/:id/coupon", deleteCoupon);
router.post("/:id/place-order", postPlaceOrder);

export default router;
