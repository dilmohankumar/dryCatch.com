import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import preferencesRoutes from "./routes/preferencesRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import fulfillmentRoutes from "./routes/fulfillmentRoutes.js";
import adminShipmentRoutes from "./routes/adminShipmentRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import shippingWebhookRoutes from "./routes/shippingWebhookRoutes.js";
import promotionRoutes from "./routes/promotionRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import productReviewRoutes from "./routes/productReviewRoutes.js";
import adminReviewRoutes, { reportsRouter as adminReviewReportRoutes } from "./routes/adminReviewRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import adminSearchRoutes from "./routes/adminSearchRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminCustomerRoutes from "./routes/adminCustomerRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import cmsPageRoutes from "./routes/cmsPageRoutes.js";
import cmsBlogRoutes from "./routes/cmsBlogRoutes.js";
import cmsRoutes from "./routes/cmsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminNotificationRoutes from "./routes/adminNotificationRoutes.js";
import adminCampaignRoutes from "./routes/adminCampaignRoutes.js";
import analyticsEventRoutes from "./routes/analyticsEventRoutes.js";
import adminAnalyticsRoutes from "./routes/adminAnalyticsRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";
import growthRoutes from "./routes/growthRoutes.js";
import adminGrowthRoutes from "./routes/adminGrowthRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import platformAdminRoutes from "./routes/platformAdminRoutes.js";
import { resolveTenantOptional } from "./middleware/tenantContext.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { sanitizeInput } from "./middleware/sanitizeInput.js";
import { requestContext } from "./middleware/requestContext.js";
import { metricsMiddleware, metricsRegistry } from "./utils/metrics.js";
import { registerEngine } from "./services/notifications/notificationEngine.js";
import { registerAnalyticsWorker } from "./services/analytics/analyticsWorker.js";
import { registerStockAlertSubscribers } from "./services/growth/stockAlertService.js";
import { registerGrowthEngine } from "./services/growth/growthEngine.js";

const app = express();

// Wires every notification rule to the event bus (Phase 16) — must happen
// once at boot, before any business module calls eventBus.publish().
registerEngine();
// Phase 17 — subscribes the analytics worker to the same event bus so
// ORDER_CREATED/PAYMENT_SUCCESSFUL/etc. update daily aggregates incrementally.
registerAnalyticsWorker();
// Phase 24 — targeted back-in-stock/price-drop notifications per subscriber.
registerStockAlertSubscribers();
// Phase 24 — loyalty earn/reversal + referral qualification, reacting to
// the same order/payment events every other phase already publishes.
registerGrowthEngine();

// Phase 22 — request ID FIRST, before anything else touches the request,
// so every subsequent log line (including a CORS rejection or a rate-limit
// 429) can be correlated. metricsMiddleware right after so it captures
// every response, including ones later middleware rejects.
app.use(requestContext);
app.use(metricsMiddleware);
app.use(helmet());
// Phase 19 — gzip/brotli response compression. JSON API responses (product
// listings, admin tables, analytics payloads) are exactly the compressible
// text content this helps most; `threshold` skips tiny responses where
// compression overhead isn't worth it, and compression's default filter
// already skips content that's already compressed (images, etc.) or opts
// out via `Cache-Control: no-transform` — never applied blindly (rule #32).
app.use(compression({ threshold: 1024 }));
// credentials:true (needed so the browser sends the httpOnly auth cookies)
// requires an explicit origin — "*" is not valid alongside credentials.
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
// `verify` stashes the exact raw bytes received — needed to check the
// Razorpay webhook's HMAC signature, which must be computed over the raw
// body, not a re-serialized (and potentially differently-formatted) copy.
app.use(express.json({ limit: "1mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());
// Phase 18 — global NoSQL-operator-injection guard (defense in depth
// behind the explicit type-checks that are the actual fix at individual
// vulnerable call sites, e.g. authController.login).
app.use(sanitizeInput);
// Phase 25 — resolves req.tenant from the Host header for EVERY request
// (logging/metrics need it even on ambiguous routes like /auth — see
// docs/multi-tenant.md section 3), but never blocks the request. Routes
// that must have a real tenant use requireTenant instead (tenantRoutes.js
// and, per the P0 roadmap, storefront routes not yet retrofitted).
app.use(resolveTenantOptional);

// Auth/OTP endpoints are brute-force/enumeration targets — throttle them tighter
// than the rest of the API instead of a single blanket limiter for everything.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});
app.use("/api/v1/auth", authLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/v1", apiLimiter);

// Phase 23 — SEO. Root-level, unversioned, unauthenticated by design
// (crawlers never send auth). See seoRoutes.js/docs/seo.md for the
// deployment note about which origin these actually need to be served from.
app.use(seoRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/ready", async (req, res) => {
  const mongoose = (await import("mongoose")).default;
  const isConnected = mongoose.connection.readyState === 1;
  res.status(isConnected ? 200 : 503).json({ ok: isConnected, mongo: mongoose.STATES[mongoose.connection.readyState] });
});
// Phase 22 — Prometheus exposition format. Not authenticated: this
// mirrors /health/ready's own posture (no secrets in the payload — just
// counters/histograms with bounded label sets) and matches how a
// Prometheus scraper expects to reach it directly. If this is ever
// exposed beyond an internal network, put it behind the reverse
// proxy/firewall Phase 21 documented, not application-level auth.
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegistry.register.contentType);
  res.end(await metricsRegistry.register.metrics());
});

const v1 = express.Router();
v1.use("/auth", authRoutes);
v1.use("/products/:productId/reviews", productReviewRoutes);
v1.use("/products", productRoutes);
v1.use("/categories", categoryRoutes);
v1.use("/cart", cartRoutes);
v1.use("/wishlist", wishlistRoutes);
v1.use("/addresses", addressRoutes);
v1.use("/preferences", preferencesRoutes);
v1.use("/collections", collectionRoutes);
v1.use("/admin/inventory", inventoryRoutes);
v1.use("/orders", orderRoutes);
v1.use("/checkout", checkoutRoutes);
v1.use("/payments", paymentRoutes);
v1.use("/reviews", reviewRoutes);
v1.use("/admin/reviews", adminReviewRoutes);
v1.use("/admin/review-reports", adminReviewReportRoutes);
v1.use("/search", searchRoutes);
v1.use("/admin/search", adminSearchRoutes);
v1.use("/admin/dashboard", adminDashboardRoutes);
v1.use("/admin/roles", roleRoutes);
v1.use("/admin/admin-users", adminUserRoutes);
v1.use("/admin/customers", adminCustomerRoutes);
v1.use("/admin/audit-logs", auditLogRoutes);
v1.use("/content", contentRoutes);
v1.use("/admin/cms/pages", cmsPageRoutes);
v1.use("/admin/cms/blog", cmsBlogRoutes);
v1.use("/admin/cms", cmsRoutes);
v1.use("/admin/warehouses", warehouseRoutes);
v1.use("/admin/fulfillments", fulfillmentRoutes);
v1.use("/admin/shipments", adminShipmentRoutes);
v1.use("/shipments", shipmentRoutes);
v1.use("/shipping", shippingWebhookRoutes);
v1.use("/admin/promotions", promotionRoutes);
v1.use("/admin/coupons", couponRoutes);
v1.use("/notifications", notificationRoutes);
v1.use("/admin/notifications", adminNotificationRoutes);
v1.use("/admin/campaigns", adminCampaignRoutes);
v1.use("/growth", growthRoutes);
v1.use("/admin/growth", adminGrowthRoutes);
v1.use("/tenant", tenantRoutes);
v1.use("/platform/admin", platformAdminRoutes);
v1.use("/analytics", analyticsEventRoutes);
v1.use("/admin/analytics", adminAnalyticsRoutes);
app.use("/api/v1", v1);

app.use(notFound);
app.use(errorHandler);

export default app;
