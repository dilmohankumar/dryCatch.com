import { Router } from "express";
import { protect, adminOnly } from "../middleware/auth.js";
import { requirePermission } from "../utils/rbac.js";
import * as c from "../controllers/admin/analyticsAdminController.js";

// Mounted at /api/v1/admin/analytics (Phase 17). Each category route is
// gated by its own permission (rule #104) in addition to the blanket
// `analytics.read` most roles hold — a role scoped to just
// `analytics.inventory.read` can hit /inventory but gets 403 on /customers.
const router = Router();
router.use(protect, adminOnly);

router.get("/overview", requirePermission("analytics.read"), c.overview);
router.get("/sales", requirePermission("analytics.sales.read"), c.sales);
router.get("/revenue", requirePermission("analytics.sales.read"), c.revenue);
router.get("/orders", requirePermission("analytics.sales.read"), c.orders);
router.get("/customers", requirePermission("analytics.customers.read"), c.customers);
router.get("/customers/clv", requirePermission("analytics.customers.read"), c.customerLifetimeValue);
router.get("/customers/retention", requirePermission("analytics.customers.read"), c.retention);
router.get("/products", requirePermission("analytics.products.read"), c.products);
router.get("/categories", requirePermission("analytics.products.read"), c.categories);
router.get("/inventory", requirePermission("analytics.inventory.read"), c.inventory);
router.get("/inventory/low-stock", requirePermission("analytics.inventory.read"), c.lowStock);
router.get("/payments", requirePermission("analytics.payments.read"), c.payments);
router.get("/shipping", requirePermission("analytics.shipping.read"), c.shipping);
router.get("/discounts", requirePermission("analytics.marketing.read"), c.discounts);
router.get("/reviews", requirePermission("analytics.marketing.read"), c.reviews);
router.get("/search", requirePermission("analytics.marketing.read"), c.search);
router.get("/notifications", requirePermission("analytics.marketing.read"), c.notifications);
router.get("/funnel", requirePermission("analytics.read"), c.funnel);
router.get("/cohorts", requirePermission("analytics.customers.read"), c.cohorts);

router.post("/exports", requirePermission("analytics.export"), c.requestExport);
router.get("/exports/:id", requirePermission("analytics.export"), c.getExportStatus);
router.get("/exports/:id/download", requirePermission("analytics.export"), c.downloadExport);

router.get("/reports", requirePermission("analytics.reports.manage"), c.listReports);
router.post("/reports", requirePermission("analytics.reports.manage"), c.createReport);
router.post("/reports/:id/run", requirePermission("analytics.reports.send"), c.runReport);

router.get("/reconcile", requirePermission("analytics.rebuild"), c.reconcile);
router.post("/rebuild", requirePermission("analytics.rebuild"), c.rebuild);

export default router;
