import { Router } from "express";
import rateLimit from "express-rate-limit";
import { protect, optionalAuth } from "../middleware/auth.js";
import { identifyCart } from "../middleware/cartIdentity.js";
import * as c from "../controllers/growthController.js";

// Mounted at /api/v1/growth — mixes guest-accessible (recently viewed,
// recommendations, view tracking) and authenticated-only (reorder, stock
// alerts, loyalty, referrals) endpoints, same split as the rest of this
// project's customer-facing routes.
const router = Router();

const viewTrackingLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }); // abuse prevention (rule #71) — same order of magnitude as Phase 17's analytics ingestion limiter

router.use(optionalAuth);

router.post("/views", viewTrackingLimiter, c.recordProductView);
router.get("/recently-viewed", c.getRecentlyViewed);
router.get("/products/:productId/related", c.getRelatedProducts);
router.get("/products/:productId/frequently-bought-together", c.getFrequentlyBoughtTogether);
router.get("/flags/:key", c.checkFeatureFlag);

// Everything below requires a real account.
router.use(protect);

router.get("/orders/:orderId/reorder-preview", c.getReorderPreview);
router.post("/orders/:orderId/reorder", identifyCart, c.postReorder);

router.post("/stock-alerts", rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), c.subscribeStockAlert);
router.delete("/stock-alerts/:id", c.unsubscribeStockAlert);
router.get("/stock-alerts", c.listMyStockAlerts);

router.get("/loyalty/balance", c.getMyLoyaltyBalance);
router.get("/loyalty/ledger", c.getMyLoyaltyLedger);

router.get("/referrals/code", c.getMyReferralCode);
router.get("/referrals", c.getMyReferrals);

export default router;
