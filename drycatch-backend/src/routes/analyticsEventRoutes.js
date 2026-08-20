import { Router } from "express";
import rateLimit from "express-rate-limit";
import { optionalAuth } from "../middleware/auth.js";
import { trackEvent, trackEventBatch } from "../controllers/analyticsEventController.js";

// Mounted at /api/v1/analytics — public ingestion, but rate-limited harder
// than the general API (rule #129/#131 — expensive-query/abuse protection
// starts at ingestion, not just at the read side).
const router = Router();
const trackLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

router.use(optionalAuth); // ties the event to req.user if logged in, anonymousId otherwise
router.post("/events", trackLimiter, trackEvent);
router.post("/events/batch", trackLimiter, trackEventBatch);

export default router;
