import { Router } from "express";
import rateLimit from "express-rate-limit";
import { optionalAuth } from "../middleware/auth.js";
import { getSearch, getAutocomplete, getSuggestions, postClickEvent } from "../controllers/searchController.js";

// Mounted at /api/v1/search — public, but rate-limited (rule #119/#120:
// search/autocomplete are bot-scraping targets, especially for anonymous
// traffic). Looser than the coupon/review limiters since normal shopping
// behavior legitimately fires many autocomplete requests per session.
const router = Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many search requests, please slow down" },
});
const autocompleteLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many requests, please slow down" },
});

router.get("/", searchLimiter, optionalAuth, getSearch);
router.get("/autocomplete", autocompleteLimiter, optionalAuth, getAutocomplete);
router.get("/suggestions", autocompleteLimiter, optionalAuth, getSuggestions);
router.post("/events/click", optionalAuth, postClickEvent);

export default router;
