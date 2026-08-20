import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { handleWebhook, createRefund } from "../controllers/paymentController.js";

const router = Router();

// No auth middleware — the payment provider calls this directly, not a
// logged-in customer. Trust is established entirely by the HMAC signature
// check inside paymentService, computed over the raw request body.
// :provider keeps the URL provider-agnostic (razorpay today, stripe if it's
// ever configured) without adding a second near-identical route.
router.post("/webhook/:provider", handleWebhook);

// Admin-only — refunds are not a customer-initiated action in this phase
// (the spec explicitly scopes refund UI to a later Admin module).
router.post("/:paymentId/refund", protect, adminOnly, createRefund);

export default router;
