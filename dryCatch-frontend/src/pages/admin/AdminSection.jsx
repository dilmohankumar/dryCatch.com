import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout.jsx";
import AdminDashboardPage from "./AdminDashboardPage.jsx";
import RolesPage from "./RolesPage.jsx";
import AdminUsersPage from "./AdminUsersPage.jsx";
import AdminCustomersPage from "./AdminCustomersPage.jsx";
import AuditLogPage from "./AuditLogPage.jsx";
import CMSPagesPage from "./cms/CMSPagesPage.jsx";
import CMSPageEditor from "./cms/CMSPageEditor.jsx";
import CMSMediaPage from "./cms/CMSMediaPage.jsx";
import CMSFaqPage from "./cms/CMSFaqPage.jsx";
import CMSBannersPage from "./cms/CMSBannersPage.jsx";
import CMSRedirectsPage from "./cms/CMSRedirectsPage.jsx";
import NotificationDashboard from "./notifications/NotificationDashboard.jsx";
import DeliveryLogs from "./notifications/DeliveryLogs.jsx";
import DeadLetterQueue from "./notifications/DeadLetterQueue.jsx";
import NotificationTemplates from "./notifications/NotificationTemplates.jsx";
import Campaigns from "./notifications/Campaigns.jsx";
import AnalyticsOverview from "./analytics/AnalyticsOverview.jsx";
import AnalyticsSales from "./analytics/AnalyticsSales.jsx";
import AnalyticsCustomers from "./analytics/AnalyticsCustomers.jsx";
import AnalyticsProducts from "./analytics/AnalyticsProducts.jsx";
import AnalyticsInventory from "./analytics/AnalyticsInventory.jsx";
import AnalyticsPayments from "./analytics/AnalyticsPayments.jsx";
import AnalyticsShipping from "./analytics/AnalyticsShipping.jsx";
import AnalyticsDiscounts from "./analytics/AnalyticsDiscounts.jsx";
import AnalyticsFunnel from "./analytics/AnalyticsFunnel.jsx";
import AnalyticsCohorts from "./analytics/AnalyticsCohorts.jsx";
import AnalyticsReports from "./analytics/AnalyticsReports.jsx";

// Mounted at /admin/* by AppRoutes. Authorization is enforced by the
// backend on every request (docs/admin.md's core rule) — this route guard
// is only a UI convenience to keep customers/guests from seeing the shell
// at all, never the actual security boundary.
export default function AdminSection({ user, onLogout }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={<AdminDashboardPage />} />
        <Route path="/customers" element={<AdminCustomersPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/admin-users" element={<AdminUsersPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/cms/pages" element={<CMSPagesPage />} />
        <Route path="/cms/pages/:id" element={<CMSPageEditor />} />
        <Route path="/cms/media" element={<CMSMediaPage />} />
        <Route path="/cms/faqs" element={<CMSFaqPage />} />
        <Route path="/cms/banners" element={<CMSBannersPage />} />
        <Route path="/cms/redirects" element={<CMSRedirectsPage />} />
        <Route path="/notifications" element={<NotificationDashboard />} />
        <Route path="/notifications/deliveries" element={<DeliveryLogs />} />
        <Route path="/notifications/dead-letter" element={<DeadLetterQueue />} />
        <Route path="/notifications/templates" element={<NotificationTemplates />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/analytics" element={<AnalyticsOverview />} />
        <Route path="/analytics/sales" element={<AnalyticsSales />} />
        <Route path="/analytics/customers" element={<AnalyticsCustomers />} />
        <Route path="/analytics/products" element={<AnalyticsProducts />} />
        <Route path="/analytics/inventory" element={<AnalyticsInventory />} />
        <Route path="/analytics/payments" element={<AnalyticsPayments />} />
        <Route path="/analytics/shipping" element={<AnalyticsShipping />} />
        <Route path="/analytics/discounts" element={<AnalyticsDiscounts />} />
        <Route path="/analytics/funnel" element={<AnalyticsFunnel />} />
        <Route path="/analytics/cohorts" element={<AnalyticsCohorts />} />
        <Route path="/analytics/reports" element={<AnalyticsReports />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}
