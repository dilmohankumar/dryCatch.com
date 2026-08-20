import { Router } from "express";
import { handleShippingWebhook } from "../controllers/shippingWebhookController.js";

// No auth middleware — the carrier calls this directly, not a logged-in
// customer/admin. Trust comes entirely from shipmentService's signature
// check.
const router = Router();
router.post("/webhooks/:carrier", handleShippingWebhook);

export default router;
