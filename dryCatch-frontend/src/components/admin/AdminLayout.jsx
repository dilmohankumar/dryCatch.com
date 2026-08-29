import { NavLink, useNavigate } from "react-router-dom";

// Sidebar module list mirrors docs/admin.md's permission groups. Only
// Dashboard/Roles/Admin Users/Audit Log have dedicated pages this pass —
// Products/Orders/Customers link to the existing customer-facing routes
// where an admin page doesn't exist yet, rather than a dead link.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", to: "/admin", end: true },
  { key: "products", label: "Products", to: "/shop" },
  { key: "orders", label: "Orders", to: "/orders" },
  { key: "customers", label: "Customers", to: "/admin/customers" },
  { key: "roles", label: "Roles", to: "/admin/roles" },
  { key: "admin-users", label: "Admin Users", to: "/admin/admin-users" },
  { key: "audit-log", label: "Audit Log", to: "/admin/audit-log" },
];

// Phase 15 — Headless CMS. Kept as a separate group so the existing
// Phase 14 nav above stays untouched.
const CMS_NAV_ITEMS = [
  { key: "cms-pages", label: "Pages", to: "/admin/cms/pages" },
  { key: "cms-media", label: "Media", to: "/admin/cms/media" },
  { key: "cms-faqs", label: "FAQs", to: "/admin/cms/faqs" },
  { key: "cms-banners", label: "Banners", to: "/admin/cms/banners" },
  { key: "cms-redirects", label: "Redirects", to: "/admin/cms/redirects" },
];

// Phase 16 — Notifications. Same "separate group" pattern as CMS above.
const NOTIFICATION_NAV_ITEMS = [
  { key: "notifications-overview", label: "Overview", to: "/admin/notifications" },
  { key: "notifications-deliveries", label: "Delivery Logs", to: "/admin/notifications/deliveries" },
  { key: "notifications-dlq", label: "Dead Letter Queue", to: "/admin/notifications/dead-letter" },
  { key: "notifications-templates", label: "Templates", to: "/admin/notifications/templates" },
  { key: "notifications-campaigns", label: "Campaigns", to: "/admin/campaigns" },
];

// Phase 17 — Analytics. Same "separate group" pattern as CMS/Notifications above.
const ANALYTICS_NAV_ITEMS = [
  { key: "analytics-overview", label: "Overview", to: "/admin/analytics" },
  { key: "analytics-sales", label: "Sales & Revenue", to: "/admin/analytics/sales" },
  { key: "analytics-customers", label: "Customers", to: "/admin/analytics/customers" },
  { key: "analytics-products", label: "Products & Categories", to: "/admin/analytics/products" },
  { key: "analytics-inventory", label: "Inventory", to: "/admin/analytics/inventory" },
  { key: "analytics-payments", label: "Payments", to: "/admin/analytics/payments" },
  { key: "analytics-shipping", label: "Shipping", to: "/admin/analytics/shipping" },
  { key: "analytics-discounts", label: "Discounts", to: "/admin/analytics/discounts" },
  { key: "analytics-funnel", label: "Funnel", to: "/admin/analytics/funnel" },
  { key: "analytics-cohorts", label: "Cohorts", to: "/admin/analytics/cohorts" },
  { key: "analytics-reports", label: "Reports", to: "/admin/analytics/reports" },
];

export default function AdminLayout({ user, onLogout, children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-gray-100 font-sans">
      <aside className="w-56 flex-shrink-0 bg-[#1A3A5C] text-white flex flex-col">
        <div
          className="px-5 py-5 text-lg font-bold border-b border-white/10 cursor-pointer"
          onClick={() => navigate("/")}
        >
          DryCatch Admin
        </div>
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">
            CMS
          </div>
          {CMS_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">
            Notifications
          </div>
          {NOTIFICATION_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === "/admin/notifications"}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40">
            Analytics
          </div>
          {ANALYTICS_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === "/admin/analytics"}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">Admin Panel</div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-800">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-gray-600 hover:text-red-600 transition"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
